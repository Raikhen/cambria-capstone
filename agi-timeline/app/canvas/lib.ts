/**
 * World-coordinate machinery for The Map.
 *
 * Time is mapped onto a single world axis u ∈ [0, 1] through a piecewise-linear
 * "era warp": each era owns a fixed share of the axis regardless of how many
 * calendar years it spans, so 1943–2011 (34 events) doesn't crush 2023–2026
 * (~120 events) into a wall of pixels.
 */

import { CATEGORIES, type Category, type TimelineEvent } from "@/lib/types";

/* ------------------------------------------------------------------ eras */

export interface Era {
  key: string;
  /** Charted region name, drawn as a watermark on the map. */
  name: string;
  /** Compact label for the minimap rail. */
  short: string;
  t0: number;
  t1: number;
  u0: number;
  u1: number;
}

const ERA_DEFS: Array<{
  key: string;
  name: string;
  short: string;
  start: [number, number, number];
  end: [number, number, number];
  share: number;
}> = [
  {
    key: "foundations",
    name: "Foundations",
    short: "1943–74",
    start: [1943, 0, 1],
    end: [1974, 0, 1],
    share: 0.08,
  },
  {
    key: "winters",
    name: "Winters & revival",
    short: "1974–2012",
    start: [1974, 0, 1],
    end: [2012, 5, 1],
    share: 0.12,
  },
  {
    key: "deep-learning",
    name: "Deep learning",
    short: "2012–17",
    start: [2012, 5, 1],
    end: [2017, 5, 1],
    share: 0.11,
  },
  {
    key: "transformers",
    name: "Transformers & scale",
    short: "2017–22",
    start: [2017, 5, 1],
    end: [2022, 10, 30],
    share: 0.19,
  },
  {
    key: "chatgpt",
    name: "The ChatGPT shock",
    short: "2022–24",
    start: [2022, 10, 30],
    end: [2024, 8, 1],
    share: 0.22,
  },
  {
    key: "agentic",
    name: "The agentic era",
    short: "2024–26",
    start: [2024, 8, 1],
    end: [2026, 8, 15],
    share: 0.28,
  },
];

export const ERAS: Era[] = (() => {
  let u = 0;
  return ERA_DEFS.map((d) => {
    const era: Era = {
      key: d.key,
      name: d.name,
      short: d.short,
      t0: Date.UTC(d.start[0], d.start[1], d.start[2]),
      t1: Date.UTC(d.end[0], d.end[1], d.end[2]),
      u0: u,
      u1: u + d.share,
    };
    u += d.share;
    return era;
  });
})();

const T_MIN = ERAS[0].t0;
const T_MAX = ERAS[ERAS.length - 1].t1;
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

export function timeToU(t: number): number {
  const tc = Math.min(Math.max(t, T_MIN), T_MAX);
  for (const e of ERAS) {
    if (tc <= e.t1) return e.u0 + ((tc - e.t0) / (e.t1 - e.t0)) * (e.u1 - e.u0);
  }
  return 1;
}

export function dateToU(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return timeToU(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function uToTime(u: number): number {
  const uc = Math.min(Math.max(u, 0), 1);
  for (const e of ERAS) {
    if (uc <= e.u1) return e.t0 + ((uc - e.u0) / (e.u1 - e.u0)) * (e.t1 - e.t0);
  }
  return T_MAX;
}

export function eraAtU(u: number): Era {
  for (const e of ERAS) if (u <= e.u1) return e;
  return ERAS[ERAS.length - 1];
}

/* ------------------------------------------------------------------ ticks */

export interface Tick {
  u: number;
  label: string;
  /** Major ticks get a stronger gridline and brighter label. */
  major: boolean;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEAR_STEPS = [1, 2, 5, 10, 20, 50];
const MONTH_STEPS = [1, 3, 6]; // months

/**
 * Generate axis ticks for the world range [uFrom, uTo] at scale `s` px/unit.
 * Density adapts per era, because px-per-year differs wildly across the warp.
 */
export function genTicks(uFrom: number, uTo: number, s: number): Tick[] {
  const ticks: Tick[] = [];
  const MIN_PX = 74;

  for (const era of ERAS) {
    if (era.u1 < uFrom || era.u0 > uTo) continue;
    const eraYears = (era.t1 - era.t0) / YEAR_MS;
    const pxPerYear = (s * (era.u1 - era.u0)) / eraYears;

    // Try month steps first (finest), then year steps.
    let placed = false;
    for (const m of MONTH_STEPS) {
      if ((pxPerYear * m) / 12 >= MIN_PX) {
        const d0 = new Date(era.t0);
        let y = d0.getUTCFullYear();
        let mo = Math.ceil(d0.getUTCMonth() / m) * m;
        for (;;) {
          if (mo >= 12) {
            y += Math.floor(mo / 12);
            mo = mo % 12;
          }
          const t = Date.UTC(y, mo, 1);
          if (t > era.t1) break;
          if (t >= era.t0) {
            const u = timeToU(t);
            if (u >= uFrom && u <= uTo) {
              ticks.push({
                u,
                label: mo === 0 ? String(y) : `${MONTHS_SHORT[mo]} ’${String(y).slice(2)}`,
                major: mo === 0,
              });
            }
          }
          mo += m;
        }
        placed = true;
        break;
      }
    }
    if (!placed) {
      let step = YEAR_STEPS[YEAR_STEPS.length - 1];
      for (const st of YEAR_STEPS) {
        if (st * pxPerYear >= MIN_PX) {
          step = st;
          break;
        }
      }
      const y0 = new Date(era.t0).getUTCFullYear();
      const y1 = new Date(era.t1).getUTCFullYear();
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
        const t = Date.UTC(y, 0, 1);
        if (t < era.t0 || t > era.t1) continue;
        const u = timeToU(t);
        if (u < uFrom || u > uTo) continue;
        ticks.push({ u, label: String(y), major: y % (step * 5) === 0 });
      }
    }
  }

  // Dedupe ticks that collide across era boundaries (keep the earlier one).
  ticks.sort((a, b) => a.u - b.u);
  const out: Tick[] = [];
  for (const t of ticks) {
    const prev = out[out.length - 1];
    if (prev && (t.u - prev.u) * s < 40) continue;
    out.push(t);
  }
  return out;
}

/* ------------------------------------------------------------- formatting */

/** Honor date_precision: year → "1956", month → "March 2023", day → full. */
export function fmtEventDate(ev: Pick<TimelineEvent, "date" | "date_precision">): string {
  const [y, m, d] = ev.date.split("-").map(Number);
  if (ev.date_precision === "year") return String(y);
  if (ev.date_precision === "month") return `${MONTHS_LONG[(m || 1) - 1]} ${y}`;
  return `${MONTHS_LONG[(m || 1) - 1]} ${d}, ${y}`;
}

export function eventYear(ev: Pick<TimelineEvent, "date">): string {
  return ev.date.slice(0, 4);
}

/** Cursor readout: precision follows the local px-per-year at that point. */
export function fmtCursorDate(u: number, s: number): string {
  const era = eraAtU(u);
  const eraYears = (era.t1 - era.t0) / YEAR_MS;
  const pxPerYear = (s * (era.u1 - era.u0)) / eraYears;
  const dt = new Date(uToTime(u));
  const y = dt.getUTCFullYear();
  if (pxPerYear >= 2600)
    return `${MONTHS_SHORT[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${y}`;
  if (pxPerYear >= 300) return `${MONTHS_SHORT[dt.getUTCMonth()]} ${y}`;
  return String(y);
}

/* ---------------------------------------------------------------- labels */

export const CAT_LABEL: Record<Category, string> = {
  capabilities: "Capabilities",
  safety: "Safety",
  governance: "Governance",
  industry: "Industry",
  research: "Research",
  culture: "Culture",
};

export const IMP_LABEL: Record<number, string> = {
  5: "Textbook",
  4: "Major",
  3: "Notable",
  2: "Context",
  1: "Footnote",
};

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  official: "Official",
  news: "News",
  paper: "Paper",
  blog: "Blog",
  tweet: "Post",
  wiki: "Wiki",
};

export const PLATFORM_LABEL: Record<string, string> = {
  x: "on 𝕏",
  substack: "on Substack",
  blog: "on their blog",
  news: "in the press",
  other: "",
};

/** Minimum importance whose labels are pinned open at zoom factor z. */
export function labelTier(z: number): number {
  if (z >= 13) return 2;
  if (z >= 6) return 3;
  if (z >= 2.4) return 4;
  return 5;
}

/* ---------------------------------------------------------------- layout */

export interface Placed {
  ev: TimelineEvent;
  u: number;
  /** World-layer x in px at the scale the layout was computed for. */
  x: number;
  lane: number;
  row: number;
}

/** Row fractions within a lane — center first, then fan out. */
export const ROW_FRAC = [0.5, 0.26, 0.74, 0.12];

/**
 * Assign each event a lane (its primary category) and a collision row within
 * the lane, greedy by date order at the given px scale.
 */
export function layoutMarkers(events: TimelineEvent[], s: number): Placed[] {
  const lastX: number[][] = CATEGORIES.map(() => ROW_FRAC.map(() => -Infinity));
  const out: Placed[] = [];
  for (const ev of events) {
    const u = dateToU(ev.date);
    const x = u * s;
    const lane = CATEGORIES.indexOf(ev.category);
    const rows = lastX[lane];
    const gap = ev.importance >= 5 ? 30 : ev.importance >= 4 ? 18 : 13;
    let row = rows.findIndex((lx) => x - lx >= gap);
    if (row === -1) {
      let min = 0;
      for (let i = 1; i < rows.length; i++) if (rows[i] < rows[min]) min = i;
      row = min;
    }
    rows[row] = x;
    out.push({ ev, u, x, lane, row });
  }
  return out;
}

/* ----------------------------------------------------------------- misc */

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export const Z_MIN = 1;
export const Z_MAX = 200;

export interface View {
  /** World u at the left edge of the viewport. */
  o: number;
  /** Zoom factor: viewport shows 1/z of the world. */
  z: number;
}

export function clampView(o: number, z: number): View {
  const zc = clamp(z, Z_MIN, Z_MAX);
  const span = 1 / zc;
  const pad = 0.012 / zc + 0.004;
  return { o: clamp(o, -pad, 1 + pad - span), z: zc };
}

export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}
