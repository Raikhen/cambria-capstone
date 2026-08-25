/**
 * Autonomous ingestion pipeline for the AGI Timeline.
 *
 * Gathers human-written source material (Zvi Mowshowitz's Substack), asks
 * Claude — acting strictly as a selector/condenser under the editorial policy
 * in docs/INCLUSION_CRITERIA.md — to propose timeline operations, then
 * mechanically enforces grounding before writing anything to Supabase.
 *
 * Usage (bun auto-loads .env.local from the project root):
 *   bun run scripts/ingest.ts             # full run: writes events + a run row
 *   bun run scripts/ingest.ts --dry-run   # full pipeline, prints proposals, writes nothing
 *   bun run scripts/ingest.ts --no-llm    # debug: everything up to the Claude call, no writes
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
 * optional X_BEARER_TOKEN (hydrates tweet quotes; clean no-op without it).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateEvent } from "../lib/validate";
import {
  CATEGORIES,
  DATE_PRECISIONS,
  REACTION_PLATFORMS,
  SOURCE_TYPES,
  type EventReaction,
  type EventSource,
  type TimelineEvent,
} from "../lib/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");
const NO_LLM = process.argv.includes("--no-llm"); // implies no writes
const WRITE_MODE = !DRY_RUN && !NO_LLM;

const FEED_URL = "https://thezvi.substack.com/feed";
const FIRST_RUN_WINDOW_DAYS = 21;
const OVERLAP_MARGIN_DAYS = 7;
const DEDUPE_CONTEXT_DAYS = 90;
const MATERIAL_CHAR_CAP = 150_000;
const PER_POST_CHAR_CAP = 60_000; // Zvi's weekly roundups run 90k+; keep breadth across posts
const MODEL = "claude-sonnet-5"; // current best cost-effective model
const MAX_MODEL_ITERATIONS = 12;
const MAX_WEB_SEARCHES = 8;
const FETCH_TIMEOUT_MS = 45_000;
const ANTHROPIC_TIMEOUT_MS = 10 * 60_000; // per-call
const OVERALL_TIME_CAP_MS = 20 * 60_000; // hard cap; finalize gracefully after

const START_MS = Date.now();
const DEADLINE_MS = START_MS + OVERALL_TIME_CAP_MS;
const timedOut = () => Date.now() > DEADLINE_MS;

const DOCS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");

// ---------------------------------------------------------------------------
// Structured run log
// ---------------------------------------------------------------------------

type LogEntry = { ts: string; step: string } & Record<string, unknown>;
const runLog: LogEntry[] = [];

function log(step: string, data: Record<string, unknown> = {}): void {
  const entry: LogEntry = { ts: new Date().toISOString(), step, ...data };
  runLog.push(entry);
  console.log(`[${entry.ts}] ${step}`, Object.keys(data).length ? JSON.stringify(data) : "");
}

// ---------------------------------------------------------------------------
// Fetch with retry/backoff
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  maxAttempts = 4,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          "user-agent": "agi-timeline-ingest/1.0 (+https://github.com/agi-timeline)",
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        if (attempt === maxAttempts || timedOut()) return res;
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1000 * 2 ** (attempt - 1);
        await sleep(backoff + Math.random() * 500);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || timedOut()) throw err;
      await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 500);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// HTML → readable text (hyperlinks kept inline as markdown)
// ---------------------------------------------------------------------------

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function htmlToReadableText(html: string): string {
  let s = html;
  s = s.replace(/<(script|style|svg|noscript|head)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // Keep hyperlinks inline as markdown so quoted tweet URLs survive.
  s = s.replace(
    /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      const url = decodeEntities(href);
      if (!/^https?:\/\//i.test(url)) return text;
      return text && text !== url ? `[${text}](${url})` : url;
    },
  );
  s = s.replace(/<(?:br|hr)\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\/(?:p|div|li|ul|ol|h[1-6]|blockquote|tr|figure|figcaption|pre)>/gi, "\n");
  s = s.replace(/<blockquote\b[^>]*>/gi, "\n> ");
  s = s.replace(/<li\b[^>]*>/gi, "- ");
  s = s.replace(/<h([1-6])\b[^>]*>/gi, (_m, n: string) => `\n${"#".repeat(Number(n))} `);
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

// ---------------------------------------------------------------------------
// RSS feed parsing (no dependencies)
// ---------------------------------------------------------------------------

interface FeedItem {
  title: string;
  link: string;
  pubDate: Date;
  contentHtml: string | null;
}

function firstTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return null;
  let inner = m[1].trim();
  const cdata = inner.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdata) inner = cdata[1];
  return inner.trim();
}

function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const link = firstTag(block, "link");
    const pubDateRaw = firstTag(block, "pubDate");
    if (!link || !pubDateRaw) continue;
    const pubDate = new Date(pubDateRaw);
    if (Number.isNaN(pubDate.getTime())) continue;
    items.push({
      title: decodeEntities(firstTag(block, "title") ?? "(untitled)"),
      link: decodeEntities(link),
      pubDate,
      contentHtml: firstTag(block, "content:encoded"),
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// URL grounding
// ---------------------------------------------------------------------------

/** Normalize a URL for grounding comparison (host casing, twitter→x, tracking params, trailing slash, fragment). */
function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    let host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^mobile\./, "");
    if (host === "twitter.com" || host === "fxtwitter.com" || host === "vxtwitter.com" || host === "nitter.net") {
      host = "x.com";
    }
    const params = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (/^(utm_|ref$|ref_|fbclid|gclid|s$|t$|mkt_tok)/i.test(k)) continue;
      params.append(k, v);
    }
    const qs = params.toString();
    let pathName = u.pathname.replace(/\/+$/, "");
    return `${host}${pathName}${qs ? `?${qs}` : ""}`;
  } catch {
    return null;
  }
}

const URL_RE = /https?:\/\/[^\s"'<>()\[\]\\{}|^`]+/g;

function extractUrls(text: string, into: Set<string>): number {
  let count = 0;
  for (const m of text.matchAll(URL_RE)) {
    const n = normalizeUrl(m[0].replace(/[.,;:!?]+$/, ""));
    if (n && !into.has(n)) {
      into.add(n);
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Model output types + tool schema
// ---------------------------------------------------------------------------

interface ProposedAdd {
  slug: string;
  date: string;
  date_precision: string;
  title: string;
  summary: string;
  category: string;
  secondary_category: string | null;
  importance: number;
  importance_rationale: string;
  sources: EventSource[];
  reactions: EventReaction[];
}

interface ProposedAmend {
  slug: string;
  reactions: EventReaction[];
  sources: EventSource[];
}

interface Operations {
  adds: ProposedAdd[];
  amends: ProposedAmend[];
  notes: string;
}

const SOURCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["url", "title", "type", "author"],
  properties: {
    url: { type: "string", description: "Must be a URL present in the provided material or your web search results." },
    title: { type: "string" },
    type: { enum: [...SOURCE_TYPES] },
    author: { type: ["string", "null"] },
  },
} as const;

const REACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["author", "quote", "url", "platform"],
  properties: {
    author: { type: "string" },
    quote: { type: "string", description: "VERBATIM excerpt from the material or a fetched page. Never paraphrase." },
    url: { type: "string" },
    platform: { enum: [...REACTION_PLATFORMS] },
  },
} as const;

const SUBMIT_OPERATIONS_TOOL = {
  name: "submit_operations",
  description:
    "Submit your final timeline operations. Call exactly once. Empty adds/amends arrays are the expected output for most runs.",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    required: ["adds", "amends", "notes"],
    properties: {
      adds: {
        type: "array",
        description: "New timeline events, per the canonical event schema.",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "slug", "date", "date_precision", "title", "summary", "category",
            "secondary_category", "importance", "importance_rationale", "sources", "reactions",
          ],
          properties: {
            slug: { type: "string", description: "kebab-case, globally unique" },
            date: { type: "string", description: "ISO date YYYY-MM-DD" },
            date_precision: { enum: [...DATE_PRECISIONS] },
            title: { type: "string", description: "<= 80 chars, sentence case, no trailing period" },
            summary: { type: "string", description: "2-4 sentences, 150-600 chars, neutral encyclopedic voice" },
            category: { enum: [...CATEGORIES] },
            secondary_category: { enum: [...CATEGORIES, null] },
            importance: { type: "integer", description: "2-5 for the autonomous pipeline (never 1)" },
            importance_rationale: { type: "string" },
            sources: { type: "array", items: SOURCE_SCHEMA },
            reactions: { type: "array", items: REACTION_SCHEMA },
          },
        },
      },
      amends: {
        type: "array",
        description:
          "Merge-don't-duplicate: append reactions/sources to an EXISTING event (by slug) instead of creating a near-duplicate.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slug", "reactions", "sources"],
          properties: {
            slug: { type: "string", description: "Slug of an existing event from the dedupe context." },
            reactions: { type: "array", items: REACTION_SCHEMA },
            sources: { type: "array", items: SOURCE_SCHEMA },
          },
        },
      },
      notes: {
        type: "string",
        description: "Brief editorial notes: what you considered and why you included or excluded it.",
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const OPERATING_INSTRUCTIONS = `
---

# Operating instructions (autonomous ingestion run)

The editorial policy above is your product spec. In addition, the following rules are
absolute for this run:

1. **You are a selector and condenser, never an author.** Propose only events that are
   grounded in the source material provided in this conversation (Zvi Mowshowitz's
   recent Substack posts) — optionally corroborated by pages you find via web search.
   If the material does not support an event, it does not exist for you.
2. **Every quote must be verbatim** — an exact excerpt from the provided material or
   from a page returned by your web search. Never paraphrase, trim words inside a
   quote, or reconstruct a quote from memory.
3. **Every source URL and reaction URL must appear in the provided material or in your
   web search results.** URLs are checked mechanically after you submit; any event
   with an ungrounded URL is rejected. Never invent or guess a URL. Prefer primary
   sources (official announcement, paper, ruling) as the first source; use web search
   to locate them and to verify exact dates.
4. **Importance must be 2 or higher.** The pipeline never publishes footnotes.
   Score against history, not the news cycle.
5. **Most runs should propose ZERO events.** An empty submission is a successful,
   expected outcome — the timeline is curated history, not a news feed. When in doubt,
   leave it out.
6. **Never duplicate.** The dedupe context lists existing events. If a development is
   already on the timeline, either skip it or — if the material adds a genuinely
   notable verbatim reaction or a better source — propose an "amend" for that slug
   instead of a new event.
7. **Tweets are citations, not events.** Attach commentary (including Zvi's own
   analysis) as reactions on the event it is about.
8. Dates must be the date the thing happened (verify with web search if the material
   is ambiguous), never in the future, and use date_precision honestly.
9. Finish by calling the submit_operations tool exactly once with your final
   operations — empty arrays if nothing qualifies. Do not output events as plain text.
`;

function buildUserPrompt(
  windowStartIso: string,
  existingRecent: { slug: string; title: string; date: string }[],
  allSlugs: string[],
  material: string,
): string {
  return [
    `# Ingestion window`,
    ``,
    `Consider only developments from ${windowStartIso} to today (${new Date().toISOString().slice(0, 10)}).`,
    ``,
    `# Dedupe context`,
    ``,
    `Events already on the timeline from the last ${DEDUPE_CONTEXT_DAYS} days (date · slug · title):`,
    existingRecent.length
      ? existingRecent.map((e) => `- ${e.date} · ${e.slug} · ${e.title}`).join("\n")
      : "(none)",
    ``,
    `All existing slugs (never reuse any of these for an add; use them for amends):`,
    allSlugs.length ? allSlugs.join(", ") : "(none)",
    ``,
    `# Source material (human-written; newest first)`,
    ``,
    material,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Pipeline steps
// ---------------------------------------------------------------------------

interface GatheredMaterial {
  text: string;
  allowedUrls: Set<string>;
  postCount: number;
  truncated: boolean;
}

async function determineWindow(supabase: SupabaseClient): Promise<Date> {
  const { data, error } = await supabase
    .from("ingestion_runs")
    .select("started_at")
    .eq("status", "succeeded")
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) {
    log("window.query_error", { error: error.message });
  }
  const last = data?.[0]?.started_at ? new Date(data[0].started_at) : null;
  const start = last
    ? new Date(last.getTime() - OVERLAP_MARGIN_DAYS * 86_400_000)
    : new Date(Date.now() - FIRST_RUN_WINDOW_DAYS * 86_400_000);
  log("window.determined", {
    last_succeeded_started_at: last?.toISOString() ?? null,
    window_start: start.toISOString(),
    first_run: !last,
  });
  return start;
}

async function gatherMaterial(windowStart: Date): Promise<GatheredMaterial> {
  const allowedUrls = new Set<string>();
  allowedUrls.add(normalizeUrl(FEED_URL)!);

  const feedRes = await fetchWithRetry(FEED_URL);
  if (!feedRes.ok) throw new Error(`Feed fetch failed: HTTP ${feedRes.status}`);
  const feedXml = await feedRes.text();
  const items = parseFeed(feedXml)
    .filter((i) => i.pubDate >= windowStart)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime()); // newest first
  log("gather.feed", { items_in_feed: parseFeed(feedXml).length, items_in_window: items.length });

  const sections: string[] = [];
  let total = 0;
  let truncated = false;
  let postCount = 0;

  for (const item of items) {
    if (timedOut()) {
      log("gather.time_cap", { skipped_remaining: items.length - postCount });
      truncated = true;
      break;
    }
    let html = item.contentHtml;
    let via = "feed:content_encoded";
    if (!html) {
      try {
        const res = await fetchWithRetry(item.link);
        if (res.ok) {
          html = await res.text();
          via = "fetched:post_html";
        } else {
          log("gather.post_fetch_failed", { url: item.link, status: res.status });
          continue;
        }
      } catch (err) {
        log("gather.post_fetch_failed", { url: item.link, error: String(err) });
        continue;
      }
    }
    // Extract URLs from the raw HTML too, so href targets survive even if the
    // readable-text conversion mangles surrounding text.
    extractUrls(html, allowedUrls);
    const text = htmlToReadableText(html);
    extractUrls(text, allowedUrls);
    const nUrl = normalizeUrl(item.link);
    if (nUrl) allowedUrls.add(nUrl);

    const header = `\n\n===== POST: ${item.title} — ${item.pubDate.toISOString().slice(0, 10)} — ${item.link} =====\n\n`;
    const remaining = MATERIAL_CHAR_CAP - total - header.length;
    if (remaining <= 500) {
      truncated = true;
      log("gather.truncated", { at_post: item.title, chars_so_far: total });
      break;
    }
    let body = text;
    const bodyCap = Math.min(PER_POST_CHAR_CAP, remaining);
    if (body.length > bodyCap) {
      body = body.slice(0, bodyCap) + "\n[... truncated ...]";
      truncated = true;
      log("gather.post_truncated", { post: item.title, original_chars: text.length, kept_chars: bodyCap });
    }
    sections.push(header + body);
    total += header.length + body.length;
    postCount++;
    log("gather.post", { title: item.title, date: item.pubDate.toISOString().slice(0, 10), via, chars: body.length });
  }

  return { text: sections.join(""), allowedUrls, postCount, truncated };
}

interface DedupeContext {
  allSlugs: string[];
  recent: { slug: string; title: string; date: string }[];
}

async function fetchDedupeContext(supabase: SupabaseClient): Promise<DedupeContext> {
  const { data: slugRows, error: slugErr } = await supabase
    .from("events")
    .select("slug")
    .range(0, 9999);
  if (slugErr) throw new Error(`Failed to fetch slugs: ${slugErr.message}`);

  const sinceIso = new Date(Date.now() - DEDUPE_CONTEXT_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data: recentRows, error: recentErr } = await supabase
    .from("events")
    .select("slug,title,date")
    .gte("date", sinceIso)
    .order("date", { ascending: false })
    .range(0, 999);
  if (recentErr) throw new Error(`Failed to fetch recent events: ${recentErr.message}`);

  const ctx = {
    allSlugs: (slugRows ?? []).map((r) => r.slug as string),
    recent: (recentRows ?? []) as { slug: string; title: string; date: string }[],
  };
  log("dedupe.fetched", { total_slugs: ctx.allSlugs.length, recent_events: ctx.recent.length });
  return ctx;
}

interface ModelUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  iterations: number;
  web_search_requests: number;
}

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  allowedUrls: Set<string>,
  usage: ModelUsage,
): Promise<Operations | null> {
  const anthropic = new Anthropic({
    timeout: ANTHROPIC_TIMEOUT_MS,
    maxRetries: 4, // SDK retries 429/5xx/connection errors with backoff + respects retry-after
  });

  const tools = [
    { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: MAX_WEB_SEARCHES },
    SUBMIT_OPERATIONS_TOOL,
  ];

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];
  let nudged = false;
  let forced = false;

  for (let i = 0; i < MAX_MODEL_ITERATIONS; i++) {
    if (timedOut()) {
      log("model.time_cap", { iteration: i });
      return null;
    }
    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 16_000,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        tools,
        // Last resort only: force the submit tool. Forcing a specific tool is
        // incompatible with thinking, so disable it and strip thinking blocks
        // from the history for this call.
        ...(forced
          ? {
              tool_choice: { type: "tool" as const, name: "submit_operations" },
              thinking: { type: "disabled" as const },
            }
          : {}),
        messages: forced
          ? messages.map((m) =>
              Array.isArray(m.content)
                ? { ...m, content: m.content.filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking") }
                : m,
            )
          : messages,
      });
    } catch (err) {
      if (forced && err instanceof Anthropic.BadRequestError) {
        // The forced-call shape was rejected; degrade to zero operations
        // rather than failing the whole run.
        log("model.forced_call_rejected", { error: err.message });
        return null;
      }
      throw err;
    }

    usage.iterations++;
    usage.input_tokens += response.usage.input_tokens;
    usage.output_tokens += response.usage.output_tokens;
    usage.cache_read_input_tokens += response.usage.cache_read_input_tokens ?? 0;
    usage.web_search_requests += response.usage.server_tool_use?.web_search_requests ?? 0;

    // Harvest web-search result URLs into the allowed set (grounding).
    let harvested = 0;
    for (const block of response.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const result of block.content) {
          if (result.type === "web_search_result") {
            const n = normalizeUrl(result.url);
            if (n && !allowedUrls.has(n)) {
              allowedUrls.add(n);
              harvested++;
            }
          }
        }
      }
    }
    log("model.iteration", {
      iteration: i,
      stop_reason: response.stop_reason,
      urls_harvested_from_search: harvested,
    });

    const submit = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_operations",
    );
    if (submit) {
      const ops = submit.input as Operations;
      return {
        adds: Array.isArray(ops.adds) ? ops.adds : [],
        amends: Array.isArray(ops.amends) ? ops.amends : [],
        notes: typeof ops.notes === "string" ? ops.notes : "",
      };
    }

    if (response.stop_reason === "refusal") {
      log("model.refusal", { stop_details: response.stop_details ?? null });
      return null;
    }

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason === "max_tokens") {
      log("model.max_tokens_hit", { iteration: i });
    }

    // Ended without submitting: nudge once, then force.
    messages.push({ role: "assistant", content: response.content });
    if (!nudged) {
      nudged = true;
      messages.push({
        role: "user",
        content:
          "Call submit_operations now with your final operations (empty adds/amends arrays if nothing qualifies).",
      });
    } else {
      forced = true;
      messages.push({ role: "user", content: "Submit now." });
    }
  }

  log("model.no_submission", { iterations: usage.iterations });
  return null;
}

// ---------------------------------------------------------------------------
// Post-processing (mechanical enforcement — code, not model)
// ---------------------------------------------------------------------------

interface Rejection {
  op: "add" | "amend";
  slug: string;
  reasons: string[];
}

interface Vetted {
  adds: TimelineEvent[];
  amends: ProposedAmend[];
  rejections: Rejection[];
}

function vetOperations(
  ops: Operations,
  allowedUrls: Set<string>,
  existingSlugs: Set<string>,
  runId: string,
): Vetted {
  const rejections: Rejection[] = [];
  const adds: TimelineEvent[] = [];
  const amends: ProposedAmend[] = [];
  const batchSlugs = new Set<string>();

  const ungroundedUrls = (urls: (string | undefined)[]): string[] =>
    urls.filter((u): u is string => {
      if (typeof u !== "string") return true;
      const n = normalizeUrl(u);
      return !n || !allowedUrls.has(n);
    });

  for (const raw of ops.adds ?? []) {
    const reasons: string[] = [];
    const slug = typeof raw?.slug === "string" ? raw.slug : "(missing slug)";

    const candidate: TimelineEvent = {
      slug: raw.slug,
      date: raw.date,
      date_precision: raw.date_precision as TimelineEvent["date_precision"],
      title: raw.title,
      summary: raw.summary,
      category: raw.category as TimelineEvent["category"],
      secondary_category: (raw.secondary_category ?? null) as TimelineEvent["secondary_category"],
      importance: raw.importance,
      importance_rationale: raw.importance_rationale,
      sources: (raw.sources ?? []).map((s) => ({ ...s, author: s.author ?? undefined })),
      reactions: raw.reactions ?? [],
      added_by: `cron:${runId}`,
    };

    reasons.push(...validateEvent(candidate).map((e) => `schema: ${e}`));

    if (typeof raw.importance === "number" && raw.importance < 2) {
      reasons.push(`importance ${raw.importance} < 2 (pipeline floor)`);
    }
    if (existingSlugs.has(slug)) reasons.push(`slug collision with existing event "${slug}"`);
    if (batchSlugs.has(slug)) reasons.push(`slug collision within this batch "${slug}"`);

    const badSources = ungroundedUrls((raw.sources ?? []).map((s) => s?.url));
    if (badSources.length) {
      reasons.push(`ungrounded source URLs (not in material or web-search results): ${badSources.join(", ")}`);
    }
    const badReactions = ungroundedUrls((raw.reactions ?? []).map((r) => r?.url));
    if (badReactions.length) {
      reasons.push(`ungrounded reaction URLs: ${badReactions.join(", ")}`);
    }

    if (reasons.length) {
      rejections.push({ op: "add", slug, reasons });
    } else {
      batchSlugs.add(slug);
      adds.push(candidate);
    }
  }

  for (const raw of ops.amends ?? []) {
    const reasons: string[] = [];
    const slug = typeof raw?.slug === "string" ? raw.slug : "(missing slug)";
    const reactions = Array.isArray(raw?.reactions) ? raw.reactions : [];
    const sources = Array.isArray(raw?.sources) ? raw.sources : [];

    if (!existingSlugs.has(slug)) reasons.push(`amend target slug "${slug}" does not exist`);
    if (reactions.length === 0 && sources.length === 0) {
      reasons.push("amend has nothing to append (no reactions, no sources)");
    }
    for (const [i, r] of reactions.entries()) {
      if (typeof r?.quote !== "string" || r.quote.trim().length === 0) {
        reasons.push(`reactions[${i}]: empty quote`);
      }
      if (typeof r?.author !== "string" || r.author.trim().length === 0) {
        reasons.push(`reactions[${i}]: missing author`);
      }
      if (!REACTION_PLATFORMS.includes(r?.platform as never)) {
        reasons.push(`reactions[${i}]: invalid platform "${String(r?.platform)}"`);
      }
    }
    for (const [i, s] of sources.entries()) {
      if (typeof s?.title !== "string" || s.title.length === 0) reasons.push(`sources[${i}]: missing title`);
      if (!SOURCE_TYPES.includes(s?.type as never)) reasons.push(`sources[${i}]: invalid type "${String(s?.type)}"`);
    }
    const badUrls = ungroundedUrls([
      ...reactions.map((r) => r?.url),
      ...sources.map((s) => s?.url),
    ]);
    if (badUrls.length) reasons.push(`ungrounded URLs: ${badUrls.join(", ")}`);

    if (reasons.length) {
      rejections.push({ op: "amend", slug, reasons });
    } else {
      amends.push({
        slug,
        reactions,
        sources: sources.map((s) => ({ ...s, author: s.author ?? undefined })),
      });
    }
  }

  return { adds, amends, rejections };
}

// ---------------------------------------------------------------------------
// Optional X (Twitter) hydration — clean no-op without X_BEARER_TOKEN
// ---------------------------------------------------------------------------

async function hydrateXReactions(
  adds: TimelineEvent[],
  amends: ProposedAmend[],
): Promise<void> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    log("x.skipped", { reason: "X_BEARER_TOKEN not set" });
    return;
  }
  const allReactions: EventReaction[] = [
    ...adds.flatMap((a) => a.reactions ?? []),
    ...amends.flatMap((a) => a.reactions),
  ];
  let hydrated = 0;
  let failed = 0;
  for (const reaction of allReactions) {
    if (reaction.platform !== "x") continue;
    const m = reaction.url.match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i);
    if (!m) continue;
    if (timedOut()) break;
    try {
      const res = await fetchWithRetry(
        `https://api.x.com/2/tweets/${m[1]}?tweet.fields=text&expansions=author_id&user.fields=name,username`,
        { headers: { authorization: `Bearer ${token}` } },
        2,
      );
      if (!res.ok) {
        failed++;
        log("x.fetch_failed", { tweet_id: m[1], status: res.status });
        continue;
      }
      const body = (await res.json()) as {
        data?: { text?: string };
        includes?: { users?: { name?: string; username?: string }[] };
      };
      if (body.data?.text) {
        reaction.quote = body.data.text;
        const user = body.includes?.users?.[0];
        if (user?.name) {
          reaction.author = user.username ? `${user.name} (@${user.username})` : user.name;
        }
        hydrated++;
      }
    } catch (err) {
      failed++;
      log("x.fetch_failed", { tweet_id: m[1], error: String(err) });
    }
  }
  log("x.hydrated", { hydrated, failed });
}

// ---------------------------------------------------------------------------
// Writes (idempotent)
// ---------------------------------------------------------------------------

async function writeAdds(supabase: SupabaseClient, adds: TimelineEvent[]): Promise<number> {
  let written = 0;
  for (const e of adds) {
    const { error } = await supabase.from("events").insert({
      slug: e.slug,
      date: e.date,
      date_precision: e.date_precision,
      title: e.title,
      summary: e.summary,
      category: e.category,
      secondary_category: e.secondary_category ?? null,
      importance: e.importance,
      importance_rationale: e.importance_rationale ?? null,
      sources: e.sources,
      reactions: e.reactions ?? [],
      added_by: e.added_by,
    });
    if (error) {
      if (error.code === "23505") {
        log("write.add_skipped_duplicate", { slug: e.slug });
      } else {
        log("write.add_failed", { slug: e.slug, error: error.message });
      }
      continue;
    }
    written++;
    log("write.add", { slug: e.slug, title: e.title, importance: e.importance });
  }
  return written;
}

async function writeAmends(supabase: SupabaseClient, amends: ProposedAmend[]): Promise<number> {
  let written = 0;
  for (const amend of amends) {
    const { data, error } = await supabase
      .from("events")
      .select("id,sources,reactions")
      .eq("slug", amend.slug)
      .single();
    if (error || !data) {
      log("write.amend_failed", { slug: amend.slug, error: error?.message ?? "not found" });
      continue;
    }
    const existingSources = (data.sources ?? []) as EventSource[];
    const existingReactions = (data.reactions ?? []) as EventReaction[];
    const existingUrls = new Set(
      [...existingSources, ...existingReactions]
        .map((x) => normalizeUrl(x.url))
        .filter(Boolean),
    );
    const newSources = amend.sources.filter((s) => !existingUrls.has(normalizeUrl(s.url)));
    const newReactions = amend.reactions.filter((r) => !existingUrls.has(normalizeUrl(r.url)));
    if (newSources.length === 0 && newReactions.length === 0) {
      log("write.amend_noop", { slug: amend.slug, reason: "all URLs already present (idempotent skip)" });
      continue;
    }
    const { error: updateErr } = await supabase
      .from("events")
      .update({
        sources: [...existingSources, ...newSources],
        reactions: [...existingReactions, ...newReactions],
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updateErr) {
      log("write.amend_failed", { slug: amend.slug, error: updateErr.message });
      continue;
    }
    written++;
    log("write.amend", {
      slug: amend.slug,
      sources_appended: newSources.length,
      reactions_appended: newReactions.length,
    });
  }
  return written;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    return 1;
  }
  if (!NO_LLM && !process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY (use --no-llm to test the gather phase without it).");
    return 1;
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  log("run.start", { mode: WRITE_MODE ? "write" : NO_LLM ? "no-llm" : "dry-run", model: MODEL });

  // a. Run row (skipped entirely in dry-run / no-llm modes — reads only).
  let runId = "dry-run";
  if (WRITE_MODE) {
    const { data, error } = await supabase
      .from("ingestion_runs")
      .insert({ status: "running", log: [] })
      .select("id")
      .single();
    if (error || !data) {
      console.error(`Failed to create ingestion_runs row: ${error?.message}`);
      return 1;
    }
    runId = data.id as string;
    log("run.created", { run_id: runId });
  }

  let status = "failed";
  let eventsAdded = 0;
  let eventsConsidered = 0;
  const usage: ModelUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    iterations: 0,
    web_search_requests: 0,
  };

  try {
    // b. Window
    const windowStart = await determineWindow(supabase);

    // c. Gather human-written source material
    const material = await gatherMaterial(windowStart);
    log("gather.done", {
      posts: material.postCount,
      chars: material.text.length,
      truncated: material.truncated,
      allowed_urls: material.allowedUrls.size,
    });

    // d. Dedupe context
    const dedupe = await fetchDedupeContext(supabase);
    const existingSlugs = new Set(dedupe.allSlugs);

    if (NO_LLM) {
      status = "succeeded";
      console.log("\n--no-llm: stopping before the Claude call.");
      console.log(`  posts gathered: ${material.postCount}`);
      console.log(`  material chars: ${material.text.length} (truncated: ${material.truncated})`);
      console.log(`  allowed URLs:   ${material.allowedUrls.size}`);
      console.log(`  existing slugs: ${dedupe.allSlugs.length}, recent events: ${dedupe.recent.length}`);
      return 0;
    }

    if (material.postCount === 0) {
      log("run.no_material", { note: "no posts in window; zero events is the expected outcome" });
      status = "succeeded";
      return 0;
    }

    // e. Claude call — system prompt is the ENTIRE inclusion-criteria doc, verbatim.
    const criteria = await readFile(path.join(DOCS_DIR, "INCLUSION_CRITERIA.md"), "utf8");
    const systemPrompt = criteria + OPERATING_INSTRUCTIONS;
    const userPrompt = buildUserPrompt(
      windowStart.toISOString().slice(0, 10),
      dedupe.recent,
      dedupe.allSlugs,
      material.text,
    );

    let ops: Operations | null = null;
    if (timedOut()) {
      log("run.time_cap_before_model", {});
    } else {
      ops = await callClaude(systemPrompt, userPrompt, material.allowedUrls, usage);
    }
    log("model.usage", { ...usage });

    if (!ops) {
      log("model.no_operations", { note: "no submission captured; finalizing with zero events" });
      status = "succeeded";
      return 0;
    }
    eventsConsidered = (ops.adds?.length ?? 0) + (ops.amends?.length ?? 0);
    log("model.proposed", {
      adds: ops.adds.length,
      amends: ops.amends.length,
      notes: ops.notes.slice(0, 2000),
    });

    // f. Mechanical post-processing
    const vetted = vetOperations(ops, material.allowedUrls, existingSlugs, runId);
    for (const r of vetted.rejections) {
      log("vet.rejected", { op: r.op, slug: r.slug, reasons: r.reasons });
    }
    log("vet.done", {
      accepted_adds: vetted.adds.length,
      accepted_amends: vetted.amends.length,
      rejected: vetted.rejections.length,
    });

    // g. Optional X hydration
    await hydrateXReactions(vetted.adds, vetted.amends);

    if (DRY_RUN) {
      console.log("\n===== DRY RUN — proposed operations (nothing written) =====\n");
      console.log(JSON.stringify(
        {
          model_notes: ops.notes,
          accepted_adds: vetted.adds,
          accepted_amends: vetted.amends,
          rejections: vetted.rejections,
          usage,
        },
        null,
        2,
      ));
      status = "succeeded";
      return 0;
    }

    // h. Writes
    if (timedOut()) {
      log("run.time_cap_before_writes", { note: "skipping writes; finalizing gracefully" });
      status = "succeeded";
      return 0;
    }
    const addsWritten = await writeAdds(supabase, vetted.adds);
    const amendsWritten = await writeAmends(supabase, vetted.amends);
    eventsAdded = addsWritten;
    log("write.done", { adds_written: addsWritten, amends_written: amendsWritten });

    status = "succeeded";
    return 0;
  } catch (err) {
    log("run.error", { error: err instanceof Error ? (err.stack ?? err.message) : String(err) });
    status = "failed";
    return 1;
  } finally {
    log("run.finish", { status, events_added: eventsAdded, events_considered: eventsConsidered, elapsed_ms: Date.now() - START_MS });
    if (WRITE_MODE && runId !== "dry-run") {
      const { error } = await supabase
        .from("ingestion_runs")
        .update({
          status,
          finished_at: new Date().toISOString(),
          events_added: eventsAdded,
          events_considered: eventsConsidered,
          log: runLog,
        })
        .eq("id", runId);
      if (error) console.error(`Failed to finalize ingestion_runs row: ${error.message}`);
    }
  }
}

process.exit(await main());
