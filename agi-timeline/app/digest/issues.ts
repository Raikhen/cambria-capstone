/**
 * Issue chunking + shared presentation metadata for "The Artificial
 * Intelligencer" — the digest variant. Time is cut into "issues": one per era
 * while the field is sparse, half-years for 2023–24, quarters for 2025–26.
 */

import type { Category, TimelineEvent } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

export interface IssueDef {
  /** 1-based issue number, printed in the folio. */
  no: number;
  slug: string;
  /** Era name printed as the issue masthead. */
  title: string;
  /** Folio date-range label, e.g. "January–June 2023". */
  range: string;
  /** Inclusive ISO date bounds. */
  from: string;
  to: string;
}

export const ISSUES: IssueDef[] = [
  { no: 1,  slug: "foundations",   title: "The Foundations",              range: "1943–1969",             from: "1943-01-01", to: "1969-12-31" },
  { no: 2,  slug: "winters",       title: "Winters and Backpropagation",  range: "1970–1989",             from: "1970-01-01", to: "1989-12-31" },
  { no: 3,  slug: "deep-blue",     title: "Deep Blue and the Long Thaw",  range: "1990–1999",             from: "1990-01-01", to: "1999-12-31" },
  { no: 4,  slug: "quiet-ascent",  title: "The Quiet Ascent",             range: "2000–2009",             from: "2000-01-01", to: "2009-12-31" },
  { no: 5,  slug: "ignition",      title: "Deep Learning Ignites",        range: "2010–2013",             from: "2010-01-01", to: "2013-12-31" },
  { no: 6,  slug: "game-players",  title: "The Game Players",             range: "2014–2016",             from: "2014-01-01", to: "2016-12-31" },
  { no: 7,  slug: "attention",     title: "Attention Changes Everything", range: "2017–2019",             from: "2017-01-01", to: "2019-12-31" },
  { no: 8,  slug: "scaling",       title: "The Scaling Hypothesis",       range: "2020–2021",             from: "2020-01-01", to: "2021-12-31" },
  { no: 9,  slug: "breakout",      title: "Generative Breakout",          range: "2022",                  from: "2022-01-01", to: "2022-12-31" },
  { no: 10, slug: "chatgpt-shock", title: "The ChatGPT Shock",            range: "January–June 2023",     from: "2023-01-01", to: "2023-06-30" },
  { no: 11, slug: "summits",       title: "Summits and Boardrooms",       range: "July–December 2023",    from: "2023-07-01", to: "2023-12-31" },
  { no: 12, slug: "act-exodus",    title: "The Act and the Exodus",       range: "January–June 2024",     from: "2024-01-01", to: "2024-06-30" },
  { no: 13, slug: "reasoning",     title: "The Reasoning Turn",           range: "July–December 2024",    from: "2024-07-01", to: "2024-12-31" },
  { no: 14, slug: "deepseek",      title: "DeepSeek and Stargate",        range: "January–March 2025",    from: "2025-01-01", to: "2025-03-31" },
  { no: 15, slug: "scenarios",     title: "Scenarios of Superintelligence", range: "April–June 2025",     from: "2025-04-01", to: "2025-06-30" },
  { no: 16, slug: "turbulence",    title: "A Turbulent Summer",           range: "July–September 2025",   from: "2025-07-01", to: "2025-09-30" },
  { no: 17, slug: "changing-hands", title: "The Frontier Changes Hands",  range: "October–December 2025", from: "2025-10-01", to: "2025-12-31" },
  { no: 18, slug: "labs-v-state",  title: "Labs Versus the State",        range: "January–March 2026",    from: "2026-01-01", to: "2026-03-31" },
  { no: 19, slug: "glasswing",     title: "Glasswing and the Gate",       range: "April–June 2026",       from: "2026-04-01", to: "2026-06-30" },
  { no: 20, slug: "the-escape",    title: "The Escape",                   range: "July–September 2026",   from: "2026-07-01", to: "2026-09-30" },
];

export interface IssueWithEvents {
  def: IssueDef;
  /** Events surviving the active filters, sorted by date asc. */
  events: TimelineEvent[];
}

/** Assign every event to an issue; dates outside all ranges clamp to the ends. */
export function groupIntoIssues(events: TimelineEvent[]): IssueWithEvents[] {
  const buckets = new Map<string, TimelineEvent[]>();
  for (const issue of ISSUES) buckets.set(issue.slug, []);
  const first = ISSUES[0];
  const last = ISSUES[ISSUES.length - 1];
  for (const event of events) {
    const hit =
      ISSUES.find((i) => event.date >= i.from && event.date <= i.to) ??
      (event.date > last.to ? last : first);
    buckets.get(hit.slug)!.push(event);
  }
  return ISSUES.map((def) => ({ def, events: buckets.get(def.slug)! }));
}

/* ---------------------------------------------------------------- sections */

export interface CategoryMeta {
  label: string;
  /** CSS custom property holding the section's ink color. */
  cssVar: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  capabilities: { label: "Capabilities", cssVar: "--c-capabilities" },
  safety:       { label: "Safety",       cssVar: "--c-safety" },
  governance:   { label: "Governance",   cssVar: "--c-governance" },
  industry:     { label: "Industry",     cssVar: "--c-industry" },
  research:     { label: "Research",     cssVar: "--c-research" },
  culture:      { label: "Culture",      cssVar: "--c-culture" },
};

export const ALL_CATEGORIES = CATEGORIES;

/* ------------------------------------------------------------------ dates */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Precision-honoring date line: "1956" / "March 2023" / "March 14, 2023". */
export function formatEventDate(event: TimelineEvent): string {
  const [y, m, d] = event.date.split("-").map(Number);
  if (event.date_precision === "year") return String(y);
  if (event.date_precision === "month") return `${MONTHS[m - 1]} ${y}`;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Compact dateline for column items and briefs: "Mar. 14, 2023". */
export function formatEventDateShort(event: TimelineEvent): string {
  const [y, m, d] = event.date.split("-").map(Number);
  const short = MONTHS[m - 1].slice(0, 3);
  if (event.date_precision === "year") return String(y);
  if (event.date_precision === "month") return `${short}. ${y}`;
  return `${short}. ${d}, ${y}`;
}

/* -------------------------------------------------------------- placement */

/** Importance rendered as newspaper placement, for the clipping panel. */
export function placementLabel(importance: number): string {
  switch (importance) {
    case 5: return "Banner — front page";
    case 4: return "Front page, above the fold";
    case 3: return "Column item";
    case 2: return "In other news";
    default: return "Back pages";
  }
}

export const PLATFORM_LABEL: Record<string, string> = {
  x: "on X",
  substack: "on Substack",
  blog: "on their blog",
  news: "in the press",
  other: "elsewhere",
};

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  official: "Official",
  news: "News",
  paper: "Paper",
  blog: "Blog",
  tweet: "Tweet",
  wiki: "Wiki",
};
