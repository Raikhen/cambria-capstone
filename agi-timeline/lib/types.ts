/**
 * Canonical types for timeline events.
 * Mirrors docs/EVENT_SCHEMA.md — keep in sync with that document,
 * the Supabase `events` table, and the ingestion pipeline.
 */

export const CATEGORIES = [
  "capabilities",
  "safety",
  "governance",
  "industry",
  "research",
  "culture",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const DATE_PRECISIONS = ["day", "month", "year"] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export const SOURCE_TYPES = [
  "official",
  "news",
  "paper",
  "blog",
  "tweet",
  "wiki",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const REACTION_PLATFORMS = [
  "x",
  "substack",
  "blog",
  "news",
  "other",
] as const;
export type ReactionPlatform = (typeof REACTION_PLATFORMS)[number];

export interface EventSource {
  /** Link to the source. First source in the array is the primary one. */
  url: string;
  title: string;
  type: SourceType;
  /** Optional author attribution. */
  author?: string;
}

export interface EventReaction {
  author: string;
  /** Verbatim excerpt — never paraphrased. */
  quote: string;
  url: string;
  platform: ReactionPlatform;
}

export interface EventImage {
  /** Absolute URL, typically the public `event-images` Supabase bucket. */
  url: string;
  /** Alt text describing the image content. */
  alt: string;
  /** Optional visible caption. */
  caption?: string;
  /** Attribution, e.g. "Photo: James the photographer (CC BY 2.0)". */
  credit?: string;
  /** Link to the original file / license page. */
  credit_url?: string;
}

export interface TimelineEvent {
  /** Present when the row comes from the database; absent in seed JSON. */
  id?: string;
  /** Stable kebab-case identifier, unique across the whole timeline. */
  slug: string;
  /** ISO date (YYYY-MM-DD). First day of month/year when precision is coarser. */
  date: string;
  date_precision: DatePrecision;
  /** Headline, <= 80 chars, sentence case, no trailing period. */
  title: string;
  /** 2–4 sentences, 150–600 chars, neutral encyclopedic voice. */
  summary: string;
  category: Category;
  secondary_category: Category | null;
  /** 1–5 per the rubric in INCLUSION_CRITERIA.md. */
  importance: number;
  /** One sentence justifying the score against the rubric. */
  importance_rationale?: string;
  /** Optional illustrative image (public domain / CC, hosted in our bucket). */
  image?: EventImage | null;
  /** >= 1 required. */
  sources: EventSource[];
  /** Optional human commentary attached to the event. */
  reactions?: EventReaction[];
  /** Provenance: "backfill:era-N" | "cron:<run-id>" | "manual". */
  added_by: string;
  created_at?: string;
  updated_at?: string;
}
