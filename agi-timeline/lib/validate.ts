/**
 * Validation for timeline events, enforcing the rules in docs/EVENT_SCHEMA.md.
 * Returns a list of human-readable errors (empty = valid) — never throws.
 */

import {
  CATEGORIES,
  DATE_PRECISIONS,
  REACTION_PLATFORMS,
  SOURCE_TYPES,
  type TimelineEvent,
} from "./types";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  // Reject dates that roll over (e.g. 2023-02-30 -> 2023-03-02).
  return d.toISOString().slice(0, 10) === value;
}

/**
 * Validate a candidate event against the canonical schema.
 * @returns an array of error messages; empty array means the event is valid.
 */
export function validateEvent(event: unknown): string[] {
  const errors: string[] = [];

  if (typeof event !== "object" || event === null || Array.isArray(event)) {
    return ["event must be a JSON object"];
  }
  const e = event as Partial<TimelineEvent> & Record<string, unknown>;

  // slug
  if (typeof e.slug !== "string" || e.slug.length === 0) {
    errors.push("slug: required string");
  } else if (!SLUG_RE.test(e.slug)) {
    errors.push(`slug: "${e.slug}" must match ^[a-z0-9]+(-[a-z0-9]+)*$`);
  }

  // date — valid ISO date, not in the future
  if (typeof e.date !== "string" || !isValidIsoDate(e.date)) {
    errors.push(`date: "${String(e.date)}" must be a valid ISO date (YYYY-MM-DD)`);
  } else {
    const today = new Date().toISOString().slice(0, 10);
    if (e.date > today) {
      errors.push(`date: "${e.date}" must not be in the future`);
    }
  }

  // date_precision
  if (!DATE_PRECISIONS.includes(e.date_precision as never)) {
    errors.push(
      `date_precision: "${String(e.date_precision)}" must be one of ${DATE_PRECISIONS.join(" | ")}`,
    );
  }

  // title — <= 80 chars
  if (typeof e.title !== "string" || e.title.trim().length === 0) {
    errors.push("title: required non-empty string");
  } else if (e.title.length > 80) {
    errors.push(`title: ${e.title.length} chars exceeds the 80-char limit`);
  }

  // summary — 150–600 chars
  if (typeof e.summary !== "string") {
    errors.push("summary: required string");
  } else if (e.summary.length < 150 || e.summary.length > 600) {
    errors.push(`summary: ${e.summary.length} chars is outside the 150–600 range`);
  }

  // category
  if (!CATEGORIES.includes(e.category as never)) {
    errors.push(
      `category: "${String(e.category)}" must be one of ${CATEGORIES.join(" | ")}`,
    );
  }

  // secondary_category — same enum or null/undefined
  if (
    e.secondary_category !== null &&
    e.secondary_category !== undefined &&
    !CATEGORIES.includes(e.secondary_category as never)
  ) {
    errors.push(
      `secondary_category: "${String(e.secondary_category)}" must be one of ${CATEGORIES.join(" | ")} or null`,
    );
  }

  // importance — 1–5 integer
  if (
    typeof e.importance !== "number" ||
    !Number.isInteger(e.importance) ||
    e.importance < 1 ||
    e.importance > 5
  ) {
    errors.push(`importance: ${String(e.importance)} must be an integer from 1 to 5`);
  }

  // importance_rationale — optional string
  if (
    e.importance_rationale !== undefined &&
    e.importance_rationale !== null &&
    typeof e.importance_rationale !== "string"
  ) {
    errors.push("importance_rationale: must be a string when present");
  }

  // sources — non-empty array of valid entries with valid URLs
  if (!Array.isArray(e.sources) || e.sources.length === 0) {
    errors.push("sources: at least one source is required");
  } else {
    e.sources.forEach((s, i) => {
      if (typeof s !== "object" || s === null) {
        errors.push(`sources[${i}]: must be an object`);
        return;
      }
      if (!isValidUrl(s.url)) {
        errors.push(`sources[${i}].url: "${String(s.url)}" is not a valid http(s) URL`);
      }
      if (typeof s.title !== "string" || s.title.length === 0) {
        errors.push(`sources[${i}].title: required string`);
      }
      if (!SOURCE_TYPES.includes(s.type as never)) {
        errors.push(
          `sources[${i}].type: "${String(s.type)}" must be one of ${SOURCE_TYPES.join(" | ")}`,
        );
      }
      if (s.author !== undefined && typeof s.author !== "string") {
        errors.push(`sources[${i}].author: must be a string when present`);
      }
    });
  }

  // reactions — optional array of valid entries
  if (e.reactions !== undefined && e.reactions !== null) {
    if (!Array.isArray(e.reactions)) {
      errors.push("reactions: must be an array when present");
    } else {
      e.reactions.forEach((r, i) => {
        if (typeof r !== "object" || r === null) {
          errors.push(`reactions[${i}]: must be an object`);
          return;
        }
        if (typeof r.author !== "string" || r.author.length === 0) {
          errors.push(`reactions[${i}].author: required string`);
        }
        if (typeof r.quote !== "string" || r.quote.length === 0) {
          errors.push(`reactions[${i}].quote: required string`);
        }
        if (!isValidUrl(r.url)) {
          errors.push(`reactions[${i}].url: "${String(r.url)}" is not a valid http(s) URL`);
        }
        if (!REACTION_PLATFORMS.includes(r.platform as never)) {
          errors.push(
            `reactions[${i}].platform: "${String(r.platform)}" must be one of ${REACTION_PLATFORMS.join(" | ")}`,
          );
        }
      });
    }
  }

  // added_by
  if (typeof e.added_by !== "string" || e.added_by.length === 0) {
    errors.push("added_by: required string");
  }

  return errors;
}
