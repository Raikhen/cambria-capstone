/**
 * Route-local helpers for The Chronicle (app/classic).
 * Era definitions, category metadata, date formatting.
 */

import type { Category, DatePrecision, TimelineEvent } from "@/lib/types";

/* ---------------------------------- eras ---------------------------------- */

export interface Era {
  id: string;
  numeral: string;
  title: string;
  span: string;
  dek: string;
  /** Inclusive ISO lower bound. */
  from: string;
  /** Exclusive ISO upper bound; undefined = open. */
  until?: string;
}

export const ERAS: Era[] = [
  {
    id: "foundations",
    numeral: "I",
    title: "The Foundations",
    span: "1943–2011",
    dek: "Sixty-eight years of ideas in search of the compute to run them — neurons on paper, two winters, and the slow assembly of a field.",
    from: "1900-01-01",
    until: "2012-01-01",
  },
  {
    id: "deep-learning",
    numeral: "II",
    title: "The Deep Learning Decade",
    span: "2012–2022",
    dek: "AlexNet lights the fuse. Neural networks go from academic heresy to industrial religion, and the scaling era begins.",
    from: "2012-01-01",
    until: "2022-11-30",
  },
  {
    id: "chatgpt-era",
    numeral: "III",
    title: "The ChatGPT Era",
    span: "Nov 2022–2024",
    dek: "A “low-key research preview” becomes the fastest-adopted product in history, and the world starts arguing about everything at once.",
    from: "2022-11-30",
    until: "2025-01-01",
  },
  {
    id: "year-2025",
    numeral: "IV",
    title: "The Year of Agents",
    span: "2025",
    dek: "Models stop merely saying things and start doing things. The race compounds — capital, compute, and talent all at once.",
    from: "2025-01-01",
    until: "2026-01-01",
  },
  {
    id: "year-2026",
    numeral: "V",
    title: "The Present",
    span: "2026",
    dek: "The part of the story still being written. Recorded here as it happens, at the same bar as the rest.",
    from: "2026-01-01",
  },
];

export function eraIdOf(date: string): string {
  for (const era of ERAS) {
    if (era.until === undefined || date < era.until) {
      if (date >= era.from) return era.id;
    }
  }
  return ERAS[ERAS.length - 1].id;
}

export interface EraGroup {
  era: Era;
  events: TimelineEvent[];
  total: number;
}

/* ------------------------------- categories ------------------------------- */

export const CATEGORY_META: Record<Category, { label: string; short: string }> =
  {
    capabilities: { label: "Capabilities", short: "Capabilities" },
    safety: { label: "Safety", short: "Safety" },
    governance: { label: "Governance", short: "Governance" },
    industry: { label: "Industry", short: "Industry" },
    research: { label: "Research", short: "Research" },
    culture: { label: "Culture", short: "Culture" },
  };

/* ---------------------------------- dates --------------------------------- */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Format an ISO date honoring its precision. Never touches Date/timezones. */
export function formatEventDate(iso: string, precision: DatePrecision): string {
  const [y, m, d] = iso.split("-");
  const month = MONTHS[Number(m) - 1] ?? "";
  if (precision === "year") return y;
  if (precision === "month") return `${month} ${y}`;
  return `${month} ${Number(d)}, ${y}`;
}

export function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const PLATFORM_LABEL: Record<string, string> = {
  x: "on X",
  substack: "on Substack",
  blog: "on their blog",
  news: "in the press",
  other: "",
};
