# Backfill research brief (shared by all era agents)

You are one of five research agents backfilling the AGI Trajectory. Before anything
else, read `docs/INCLUSION_CRITERIA.md` (editorial policy: categories, importance
rubric, inclusion tests, exclusions) and `docs/EVENT_SCHEMA.md` (exact JSON shape).
Your output must comply with both.

## Deliverables

1. **`data/seed/era-<N>-<name>.json`** — a valid JSON array of event objects (no
   comments, no trailing commas). Validate before finishing:
   `bun -e "JSON.parse(await Bun.file('<path>').text()); console.log('ok')"`.
2. **`data/seed/era-<N>-notes.md`** — your working notes: (a) 10–15 candidates you
   *considered and rejected*, each with a one-line reason citing the specific
   exclusion rule; (b) any events you included with low confidence and why. These
   notes become part of the public methodology.

## Non-negotiable rules

- **Never invent URLs, dates, quotes, or titles.** Every URL must be one you found
  via web search/fetch or are certain of. If you cannot verify something, leave it
  out or mark it in your notes.
- **Verify by web** anything from mid-2025 onward — your training data is stale
  relative to today (August 2026). Earlier events still need exact dates; check
  Wikipedia or primary sources when unsure.
- **Tweets are citations, not events.** Attach them as `reactions` with verbatim
  quotes only when you found the actual text (e.g. quoted in an article or on the
  page itself). If you know a notable reaction existed but can't recover the verbatim
  text, mention it in your notes instead of guessing.
- For modern-era events, try to attach 1–2 human `reactions` (tweets, Zvi
  Mowshowitz's commentary, notable quotes from coverage). Zvi's Substack
  (https://thezvi.substack.com/) is a prime source of linked takes.
- **Neutral voice** in summaries; opinions live in `reactions`.
- **Category balance:** no single category should exceed ~40% of your events.
- **Slugs:** descriptive kebab-case, globally unique (e.g. `alphago-lee-sedol`, not
  `event-1`).
- `added_by`: `"backfill:era-<N>"`.
- Importance scores must follow the rubric — most events are 2–3; reserve 5 for
  genuine textbook moments. Include `importance_rationale` for every event.

## Method

Work breadth-first: list candidate events for your era first (from knowledge + web
search + era-appropriate sources), apply the inclusion tests to cut the list to
target size, then research each survivor properly (dates, primary sources,
reactions). Depth over speed — this data is the product.
