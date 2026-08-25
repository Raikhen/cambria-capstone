/**
 * Server-side data layer for timeline events.
 *
 * Primary source: Supabase `events` table via the anon key (RLS public read).
 * Fallback: local seed JSON in data/seed/era-*.json when env vars are missing
 * or the table is empty (pre-migration / pre-seed development).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Category, TimelineEvent } from "./types";
import { CATEGORIES } from "./types";

const SEED_DIR = path.join(process.cwd(), "data", "seed");

async function fetchFromSupabase(): Promise<TimelineEvent[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true });
    if (error) {
      console.error("Supabase events query failed:", error.message);
      return null;
    }
    if (!data || data.length === 0) return null;
    return data as TimelineEvent[];
  } catch (err) {
    console.error("Supabase events fetch threw:", err);
    return null;
  }
}

/**
 * Read and merge every data/seed/era-*.json that exists. Tolerates the
 * directory being absent/empty and files being mid-write: each file parse is
 * wrapped in try/catch and invalid files are skipped.
 */
async function readSeedEvents(): Promise<TimelineEvent[]> {
  let fileNames: string[] = [];
  try {
    fileNames = (await fs.readdir(SEED_DIR)).filter(
      (name) => /^era-.*\.json$/.test(name),
    );
  } catch {
    return []; // directory doesn't exist yet
  }

  const events: TimelineEvent[] = [];
  const seenSlugs = new Set<string>();

  for (const name of fileNames.sort()) {
    try {
      const raw = await fs.readFile(path.join(SEED_DIR, name), "utf8");
      const parsed = JSON.parse(raw);
      const list: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.events)
          ? parsed.events
          : [];
      for (const item of list) {
        if (
          typeof item === "object" &&
          item !== null &&
          typeof (item as TimelineEvent).slug === "string" &&
          !seenSlugs.has((item as TimelineEvent).slug)
        ) {
          seenSlugs.add((item as TimelineEvent).slug);
          events.push(item as TimelineEvent);
        }
      }
    } catch {
      // File is mid-write or malformed — skip it.
    }
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return events;
}

/** Fetch all events: Supabase first, seed JSON fallback. */
export async function getAllEvents(): Promise<TimelineEvent[]> {
  const fromDb = await fetchFromSupabase();
  if (fromDb !== null) return fromDb;
  return readSeedEvents();
}

export interface EventFilters {
  /** Primary or secondary category must be in this list. */
  categories?: Category[];
  /** Minimum importance, inclusive. */
  minImportance?: number;
  /** ISO date lower bound, inclusive. */
  from?: string;
  /** ISO date upper bound, inclusive. */
  to?: string;
  /** Case-insensitive substring match against title or summary. */
  q?: string;
}

/** Fetch events with filters applied (used by the API route). */
export async function getFilteredEvents(
  filters: EventFilters = {},
): Promise<TimelineEvent[]> {
  const all = await getAllEvents();
  const categories = filters.categories?.filter((c) =>
    CATEGORIES.includes(c),
  );
  const q = filters.q?.trim().toLowerCase();

  return all.filter((event) => {
    if (categories && categories.length > 0) {
      const matches =
        categories.includes(event.category) ||
        (event.secondary_category !== null &&
          event.secondary_category !== undefined &&
          categories.includes(event.secondary_category));
      if (!matches) return false;
    }
    if (
      filters.minImportance !== undefined &&
      event.importance < filters.minImportance
    ) {
      return false;
    }
    if (filters.from && event.date < filters.from) return false;
    if (filters.to && event.date > filters.to) return false;
    if (q) {
      const haystack = `${event.title}\n${event.summary}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
