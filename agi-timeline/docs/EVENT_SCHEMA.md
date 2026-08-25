# Canonical event schema

Used by: seed JSON files in `data/seed/`, the Supabase `events` table, the API, and
the ingestion pipeline. Keep all four in sync with this document.

```jsonc
{
  // Stable kebab-case identifier, unique across the whole timeline.
  "slug": "gpt-4-release",

  // ISO date. If only the month or year is known, use the first day and set precision.
  "date": "2023-03-14",
  "date_precision": "day",            // "day" | "month" | "year"

  // Headline, ≤ 80 chars, sentence case, no trailing period.
  "title": "OpenAI releases GPT-4",

  // 2–4 sentences, neutral encyclopedic voice. States what happened and why it
  // matters. No hype adjectives, no editorializing — takes live in `reactions`.
  "summary": "...",

  "category": "capabilities",          // capabilities | safety | governance | industry | research | culture
  "secondary_category": null,          // same enum or null

  "importance": 5,                     // 1–5 per the rubric in INCLUSION_CRITERIA.md
  "importance_rationale": "One sentence justifying the score against the rubric.",

  // ≥ 1 required. First source is the primary one.
  "sources": [
    {
      "url": "https://openai.com/research/gpt-4",
      "title": "GPT-4 — OpenAI",
      "type": "official",              // official | news | paper | blog | tweet | wiki
      "author": "OpenAI"               // optional
    }
  ],

  // Human commentary attached to the event: tweets, Zvi's analysis, notable quotes.
  // Quotes must be verbatim and linked. Optional, but strongly encouraged for
  // modern-era events.
  "reactions": [
    {
      "author": "Andrej Karpathy",
      "quote": "verbatim excerpt…",
      "url": "https://x.com/karpathy/status/…",
      "platform": "x"                  // x | substack | blog | news | other
    }
  ],

  // Provenance
  "added_by": "backfill:era-3"         // "backfill:era-N" | "cron:<run-id>" | "manual"
}
```

Validation rules:
- `slug` matches `^[a-z0-9]+(-[a-z0-9]+)*$` and is globally unique.
- `date` is a valid ISO date not in the future.
- `importance` 1–5 integer; `category` in the enum; `sources` non-empty with valid URLs.
- `summary` 150–600 chars; `title` ≤ 80 chars.
