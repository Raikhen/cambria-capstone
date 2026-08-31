# Autonomous ingestion pipeline

`scripts/ingest.ts` keeps the modern end of the timeline current without a human in
the loop. It runs daily via GitHub Actions (`.github/workflows/ingest.yml`, 07:17 UTC,
plus manual `workflow_dispatch`) and is governed by `docs/INCLUSION_CRITERIA.md` — the
entire document is injected verbatim into the model's system prompt, so editing that
file (not the code) is how you change the timeline's taste.

## How a run works

1. **Run row.** Inserts an `ingestion_runs` row with `status = 'running'`. Whatever
   happens, the row is finalized as `succeeded` or `failed` with `events_added`,
   `events_considered`, and a structured `log` jsonb of every step.
2. **Window.** Looks up the last *succeeded* run's `started_at` and rewinds a 7-day
   overlap margin (so a missed event gets a second chance and idempotency does the
   dedup). First run defaults to 21 days back.
3. **Gather (human-written material only).** Fetches Zvi Mowshowitz's Substack feed
   (`https://thezvi.substack.com/feed`) and the full content of every post in the
   window (from the feed's `content:encoded`, falling back to fetching the post URL).
   HTML is converted to readable text with hyperlinks preserved inline as markdown, so
   tweet URLs quoted by Zvi survive. Total material is capped at ~150k chars, newest
   first; truncation is logged.
4. **Dedupe context.** Fetches all existing slugs plus `title + date + slug` of events
   from the last 90 days from Supabase.
5. **Claude call.** One conversation with `claude-sonnet-5`:
   - System prompt = `INCLUSION_CRITERIA.md` verbatim + strict operating
     instructions (selector/condenser, never an author; verbatim quotes only;
     honest 1–5 importance scoring; zero events is the expected outcome; merge
     instead of duplicate).
   - The server-side `web_search` tool is enabled (max 8 searches) so the model can
     verify dates and locate primary sources.
   - Output arrives through a `submit_operations` tool call with a strict JSON schema:
     `adds` (full event objects per `docs/EVENT_SCHEMA.md`) and `amends`
     (existing slug + reactions/sources to append). If the model ends its turn without
     calling the tool it is nudged once, then forced via `tool_choice`.
6. **Mechanical vetting (code, not model).** Every proposal must survive:
   - `validateEvent()` from `lib/validate.ts` (schema, date sanity, URL validity);
   - no slug collision with existing events or within the batch;
   - **grounding**: every source URL and reaction URL must be present in the set of
     allowed URLs — URLs extracted from the gathered material (raw HTML hrefs and
     converted text) plus URLs returned by the model's web searches. URLs are
     normalized before comparison (host casing, `www.`, `twitter.com → x.com`,
     tracking params, trailing slash, fragments). Anything ungrounded is rejected
     and logged with the reason;
   - amends: the target slug must exist, quotes must be non-empty, and all URLs must
     be grounded.
7. **X hydration (optional).** If `X_BEARER_TOKEN` is set, reactions with
   `platform: "x"` are hydrated from the X API v2 (`GET /2/tweets/:id`): the quote is
   replaced with the canonical tweet text and the author with the account's real
   name + handle. On any failure the sourced quote is kept. Without the token this
   step is a clean no-op.
8. **Writes.** Accepted adds are inserted (`added_by = "cron:<run-id>"`); a slug
   conflict (23505) is skipped and logged, so re-running the same window never
   duplicates. Amends append only reactions/sources whose URLs aren't already on the
   event — re-running is a logged no-op.
9. **Robustness.** Exponential backoff with jitter (respecting `retry-after`) on
   429/5xx for both HTTP fetches and Anthropic calls, per-call timeouts, and a hard
   ~20-minute overall cap after which the run finalizes gracefully with whatever it
   has (still marked `succeeded`, with `time_cap` log entries).

Most runs add zero events. That is success, not failure — the pipeline is a curator,
not a news feed.

## Running locally

Bun auto-loads `.env.local` from the project root. Required vars:
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
(optional: `X_BEARER_TOKEN`).

```bash
bun run ingest                          # full run (writes events + run row)
bun run scripts/ingest.ts --dry-run     # full pipeline incl. Claude; prints proposals + rejections; writes nothing, no run row
bun run scripts/ingest.ts --no-llm      # debug: feed fetch, post fetch, dedupe fetch; stops before the Claude call (no ANTHROPIC_API_KEY needed)
```

## GitHub setup

The workflow needs two secrets (three with X hydration). From the repo root:

```bash
gh secret set ANTHROPIC_API_KEY            # paste your Anthropic API key when prompted
gh secret set SUPABASE_SERVICE_ROLE_KEY    # paste the Supabase service-role key when prompted
gh secret set X_BEARER_TOKEN               # optional — X API v2 app bearer token
```

Never commit these values or copy them from a local `.env.local` into any file. The
public Supabase URL is hardcoded in the workflow (it is not a secret). To trigger a
run manually:

```bash
gh workflow run ingest.yml
```

## Adding the optional X token

1. Create an app in the [X developer portal](https://developer.x.com) (Basic tier or
   higher — the free tier's read limits are enough for a handful of tweet lookups per
   run).
2. Copy the app's **Bearer Token**.
3. `gh secret set X_BEARER_TOKEN` (and/or add it to `.env.local` for local runs).

With the token set, tweet quotes proposed by the model are replaced with the canonical
text from the X API; without it (or on any API failure) the verbatim quote extracted
from the source material is kept.

## Reading ingestion_runs logs

`ingestion_runs` is service-role only (no anon RLS policy), so query it from the
Supabase SQL editor or with the service key:

```sql
select id, started_at, finished_at, status, events_added, events_considered
from ingestion_runs
order by started_at desc
limit 20;
```

The `log` column is a jsonb array of `{ts, step, ...}` entries. Useful queries:

```sql
-- Everything the vetting stage rejected, with reasons
select e->>'ts' as ts, e->'slug' as slug, e->'reasons' as reasons
from ingestion_runs, jsonb_array_elements(log) e
where e->>'step' = 'vet.rejected'
order by ts desc;

-- Model usage per run
select started_at, e as usage
from ingestion_runs, jsonb_array_elements(log) e
where e->>'step' = 'model.usage'
order by started_at desc;

-- What the model proposed and why (its editorial notes)
select started_at, e->>'notes' as notes
from ingestion_runs, jsonb_array_elements(log) e
where e->>'step' = 'model.proposed'
order by started_at desc;
```

Step names to know: `window.determined`, `gather.post` / `gather.truncated`,
`dedupe.fetched`, `model.iteration` / `model.proposed` / `model.usage`,
`vet.rejected` / `vet.done`, `x.hydrated`, `write.add` / `write.add_skipped_duplicate`
/ `write.amend` / `write.amend_noop`, `run.error`, `run.finish`.

## Provenance

Every autonomously added event has `added_by = "cron:<run-id>"`, where `<run-id>` is
the `ingestion_runs.id` whose `log` records the window, the posts fetched, the model's
notes, and the vetting decisions for that event.
