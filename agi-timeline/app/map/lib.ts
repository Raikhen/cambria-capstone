/**
 * World-coordinate machinery + scene layout for The Map.
 *
 * Time is mapped onto a single world axis u ∈ [0, 1] in one of two modes:
 *
 *  - "log": reverse-logarithmic time — position on the axis grows with the
 *    log of distance from the present, so the recent, busier years get most
 *    of the room and 1943–2011 (34 events) doesn't crush 2023–2026
 *    (~150 events) into a wall of pixels. Approximated by a fine
 *    piecewise-linear warp so the segment-based tick machinery applies.
 *  - "linear": true proportional calendar time.
 *
 * Every coordinate function takes the active mode; axis ticks are plain
 * calendar years in both.
 */

import { CATEGORIES, type Category, type TimelineEvent } from "@/lib/types";

/* ----------------------------------------------------------- time warp */

export type ScaleMode = "log" | "linear";

interface Segment {
  t0: number;
  t1: number;
  u0: number;
  u1: number;
}

const T_MIN = Date.UTC(1943, 0, 1);
const T_MAX = Date.UTC(2026, 8, 15);
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

/**
 * Blank margin reserved at each end of the world axis, as a fraction of u.
 * At fit zoom the world spans the viewport exactly and clampView's overscroll
 * pad is deliberately zero, so without this the 1943 markers (r up to 7.5px)
 * would straddle the screen edge.
 */
const U_PAD = 0.012;

/**
 * Reverse-log warp: u(t) = ln(A0/a) / ln(A0/TAIL), where a = T_MAX − t + TAIL
 * is "time before the present" and A0 = T_MAX − T_MIN + TAIL. TAIL keeps the
 * warp finite at the right edge and sets how hard the recent end is
 * magnified — 3 months gives the last year ~28% of the axis and 1943–1974
 * ~8%, close to the old hand-tuned density warp. Sampled into LOG_STEPS
 * linear segments (equal in u) so both modes share the segment machinery.
 */
const LOG_TAIL = YEAR_MS / 4;
const LOG_STEPS = 96;
const LOG_SEGMENTS: Segment[] = (() => {
  const A0 = T_MAX - T_MIN + LOG_TAIL;
  const uToT = (u: number) =>
    T_MAX + LOG_TAIL - A0 * Math.pow(LOG_TAIL / A0, u);
  const pad = (u: number) => U_PAD + u * (1 - 2 * U_PAD);
  const segs: Segment[] = [];
  for (let i = 0; i < LOG_STEPS; i++) {
    segs.push({
      t0: i === 0 ? T_MIN : uToT(i / LOG_STEPS),
      t1: i === LOG_STEPS - 1 ? T_MAX : uToT((i + 1) / LOG_STEPS),
      u0: pad(i / LOG_STEPS),
      u1: pad((i + 1) / LOG_STEPS),
    });
  }
  return segs;
})();

/** Linear mode is just the trivial one-segment warp. */
const LINEAR_SEGMENTS: Segment[] = [
  { t0: T_MIN, t1: T_MAX, u0: U_PAD, u1: 1 - U_PAD },
];

function segments(mode: ScaleMode): Segment[] {
  return mode === "linear" ? LINEAR_SEGMENTS : LOG_SEGMENTS;
}

export function timeToU(t: number, mode: ScaleMode): number {
  const tc = Math.min(Math.max(t, T_MIN), T_MAX);
  for (const e of segments(mode)) {
    if (tc <= e.t1) return e.u0 + ((tc - e.t0) / (e.t1 - e.t0)) * (e.u1 - e.u0);
  }
  return 1 - U_PAD;
}

export function dateToU(iso: string, mode: ScaleMode): number {
  const [y, m, d] = iso.split("-").map(Number);
  return timeToU(Date.UTC(y, (m || 1) - 1, d || 1), mode);
}

export function uToTime(u: number, mode: ScaleMode): number {
  // Clamp into the padded range so the blank margins read as T_MIN / T_MAX
  // instead of extrapolating past them.
  const uc = Math.min(Math.max(u, U_PAD), 1 - U_PAD);
  for (const e of segments(mode)) {
    if (uc <= e.u1) return e.t0 + ((uc - e.u0) / (e.u1 - e.u0)) * (e.t1 - e.t0);
  }
  return T_MAX;
}

function segAtU(u: number, mode: ScaleMode): Segment {
  const segs = segments(mode);
  for (const e of segs) if (u <= e.u1) return e;
  return segs[segs.length - 1];
}

/** Local pixel density of calendar time at world position u, scale s px/unit. */
export function pxPerYearAt(u: number, s: number, mode: ScaleMode): number {
  const seg = segAtU(u, mode);
  const years = (seg.t1 - seg.t0) / YEAR_MS;
  return (s * (seg.u1 - seg.u0)) / years;
}

/* ------------------------------------------------------------------ ticks */

export interface Tick {
  u: number;
  label: string;
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
const MONTH_STEPS = [1, 3, 6];

/**
 * Axis ticks for the world range [uFrom, uTo] at scale `s` px/unit.
 * Density adapts per warp segment, because px-per-year differs across it.
 * Labels are plain years (or "Mar ’23" when a month is wider than MIN_PX).
 */
export function genTicks(
  uFrom: number,
  uTo: number,
  s: number,
  mode: ScaleMode,
): Tick[] {
  const ticks: Tick[] = [];
  const MIN_PX = 82;

  for (const seg of segments(mode)) {
    if (seg.u1 < uFrom || seg.u0 > uTo) continue;
    const segYears = (seg.t1 - seg.t0) / YEAR_MS;
    const pxPerYear = (s * (seg.u1 - seg.u0)) / segYears;

    let placed = false;
    for (const m of MONTH_STEPS) {
      if ((pxPerYear * m) / 12 >= MIN_PX) {
        const d0 = new Date(seg.t0);
        let y = d0.getUTCFullYear();
        let mo = Math.ceil(d0.getUTCMonth() / m) * m;
        for (;;) {
          if (mo >= 12) {
            y += Math.floor(mo / 12);
            mo = mo % 12;
          }
          const t = Date.UTC(y, mo, 1);
          if (t > seg.t1) break;
          if (t >= seg.t0) {
            const u = timeToU(t, mode);
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
      const y0 = new Date(seg.t0).getUTCFullYear();
      const y1 = new Date(seg.t1).getUTCFullYear();
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
        const t = Date.UTC(y, 0, 1);
        if (t < seg.t0 || t > seg.t1) continue;
        const u = timeToU(t, mode);
        if (u < uFrom || u > uTo) continue;
        ticks.push({ u, label: String(y), major: y % (step * 5) === 0 });
      }
    }
  }

  // Dedupe ticks that land too close across segment boundaries.
  ticks.sort((a, b) => a.u - b.u);
  const out: Tick[] = [];
  for (const t of ticks) {
    const prev = out[out.length - 1];
    if (prev && (t.u - prev.u) * s < 48) continue;
    out.push(t);
  }
  return out;
}

/** A sparse year scale for the minimap: plain years, min Δu spacing. */
export function minimapScale(mode: ScaleMode): Tick[] {
  const candidates = [
    1950, 1960, 1970, 1980, 1990, 2000, 2010, 2015,
    2018, 2020, 2022, 2023, 2024, 2025, 2026,
  ];
  const out: Tick[] = [];
  for (const y of candidates) {
    const u = timeToU(Date.UTC(y, 0, 1), mode);
    const prev = out[out.length - 1];
    if (prev && u - prev.u < 0.052) continue;
    out.push({ u, label: String(y), major: false });
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
export function fmtCursorDate(u: number, s: number, mode: ScaleMode): string {
  const ppy = pxPerYearAt(u, s, mode);
  const dt = new Date(uToTime(u, mode));
  const y = dt.getUTCFullYear();
  if (ppy >= 2600) return `${MONTHS_SHORT[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${y}`;
  if (ppy >= 300) return `${MONTHS_SHORT[dt.getUTCMonth()]} ${y}`;
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
  x: "on X",
  substack: "on Substack",
  blog: "on their blog",
  news: "in the press",
  other: "",
};

/** Minimum importance eligible for a static label at zoom factor z. */
export function labelTier(z: number): number {
  if (z >= 18) return 1;
  if (z >= 10) return 2;
  if (z >= 5) return 3;
  if (z >= 1.8) return 4;
  return 5;
}

/* ----------------------------------------------------------- scene layout
 *
 * One pure pass turns the filtered events into a fully collision-resolved
 * scene at the current scale: beeswarm marker rows around a single axis and
 * label chips fitted into horizontal tracks above/below the swarm (leader
 * lines reserved so nothing is crossed). Anything that doesn't fit is
 * dropped, in strict importance-then-recency priority. Deterministic for a
 * given input. Reactions live exclusively in the detail panel.
 */

export interface SceneMarker {
  ev: TimelineEvent;
  u: number;
  x: number;
  y: number;
  r: number;
  labeled: boolean;
}

export interface SceneLabel {
  slug: string;
  cat: Category;
  imp: number;
  title: string;
  year: string;
  /** Center x / center y of the chip. */
  x: number;
  y: number;
  w: number;
  leader: { x: number; y1: number; y2: number };
}

export interface Scene {
  markers: SceneMarker[];
  labels: SceneLabel[];
  axisY: number;
}

export interface SceneOpts {
  /** Active time-scale mode. */
  mode: ScaleMode;
  /** World scale, px per unit. */
  s: number;
  /** Stage size. */
  w: number;
  h: number;
  /** Height of the top tick ruler. */
  axisH: number;
  /** Minimum importance eligible for a static label. */
  tier: number;
  selectedSlug: string | null;
  measureUi: (text: string, px: number, weight: number) => number;
  measureMono: (text: string, px: number) => number;
}

const MARKER_R: Record<number, number> = { 1: 2.5, 2: 3, 3: 4, 4: 5.5, 5: 7.5 };
/** Beeswarm vertical offsets from the axis, tried in order. */
const SWARM_OFFSETS = [0, -13, 13, -26, 26, -39, 39];
const SWARM_ZONE = 48; // half-height of the marker band
const LABEL_ROW_H = 21;
const LABEL_GAP = 14; // min horizontal gap between label chips
const LEADER_HALF = 5; // half-width of the sliver a leader reserves

interface Interval {
  a: number;
  b: number;
  /** Set for label intervals — a leader may pass behind its own label. */
  slug?: string;
}

function fits(
  row: Interval[],
  x0: number,
  x1: number,
  ignoreSlug?: string,
): boolean {
  for (const iv of row) {
    if (ignoreSlug !== undefined && iv.slug === ignoreSlug) continue;
    if (x0 < iv.b && x1 > iv.a) return false;
  }
  return true;
}

export function layoutScene(events: TimelineEvent[], o: SceneOpts): Scene {
  const axisY = o.axisH + (o.h - o.axisH) * 0.5;
  const half = (o.h - o.axisH) * 0.5;

  /* ---- markers: beeswarm around the axis ---- */
  const swarmLast: Array<{ x: number; r: number }> = SWARM_OFFSETS.map(() => ({
    x: -Infinity,
    r: 0,
  }));
  const markers: SceneMarker[] = [];
  const bySlug = new Map<string, SceneMarker>();
  const nOffsets = half >= SWARM_ZONE + 30 ? SWARM_OFFSETS.length : 5;
  for (const ev of events) {
    const u = dateToU(ev.date, o.mode);
    const x = u * o.s;
    const r = MARKER_R[ev.importance] ?? 4;
    let idx = -1;
    for (let i = 0; i < nOffsets; i++) {
      const last = swarmLast[i];
      if (x - last.x >= r + last.r + 5) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      idx = 0;
      for (let i = 1; i < nOffsets; i++)
        if (swarmLast[i].x < swarmLast[idx].x) idx = i;
    }
    swarmLast[idx] = { x, r };
    const m: SceneMarker = {
      ev,
      u,
      x,
      y: axisY + SWARM_OFFSETS[idx],
      r,
      labeled: false,
    };
    markers.push(m);
    bySlug.set(ev.slug, m);
  }

  /* ---- geometry of the label tracks ---- */
  const labelBase = SWARM_ZONE + 14; // first label row center, from axis
  const rowsFor = (room: number) =>
    Math.max(1, Math.min(4, Math.floor((room - labelBase - 16) / LABEL_ROW_H) + 1));
  const rowsAbove = rowsFor(axisY - o.axisH);
  const rowsBelow = rowsFor(o.h - axisY);

  // occupied[side][row] — side 0 = above, 1 = below. Row arrays hold label
  // intervals and reserved leader slivers.
  const occupied: Interval[][][] = [
    Array.from({ length: rowsAbove }, () => []),
    Array.from({ length: rowsBelow }, () => []),
  ];
  const labelRowY = (side: number, row: number) =>
    side === 0
      ? axisY - labelBase - row * LABEL_ROW_H
      : axisY + labelBase + row * LABEL_ROW_H;

  /* ---- labels: importance desc, then recency desc ---- */
  const candidates = markers
    .filter((m) => m.ev.importance >= o.tier)
    .sort((a, b) =>
      b.ev.importance !== a.ev.importance
        ? b.ev.importance - a.ev.importance
        : b.ev.date < a.ev.date
          ? -1
          : 1,
    );
  // Selected event's label is always attempted first.
  if (o.selectedSlug) {
    const sel = bySlug.get(o.selectedSlug);
    if (sel) {
      const i = candidates.indexOf(sel);
      if (i > 0) {
        candidates.splice(i, 1);
        candidates.unshift(sel);
      } else if (i === -1) {
        candidates.unshift(sel);
      }
    }
  }

  const labels: SceneLabel[] = [];
  for (const m of candidates) {
    const big = m.ev.importance === 5;
    const fontPx = big ? 13 : 12;
    const fontWt = big ? 600 : 500;
    const yearW = o.measureMono(eventYear(m.ev), 9.5);
    let title = m.ev.title;
    let titleW = o.measureUi(title, fontPx, fontWt);
    // Never let a single label exceed the viewport: truncate with ellipsis.
    const maxTitleW = o.w - 32 - 7 - yearW;
    while (titleW > maxTitleW && title.length > 12) {
      const ratio = Math.min(0.94, maxTitleW / titleW);
      title = `${title.replace(/…$/, "").slice(0, Math.floor(title.length * ratio) - 1).trimEnd()}…`;
      titleW = o.measureUi(title, fontPx, fontWt);
    }
    const w = titleW + 7 + yearW;
    // Shift labels of events near the world's edges inward (as far as the
    // leader still lands inside the chip) so they don't clip at fit zoom.
    const maxShift = Math.max(0, w / 2 - 2);
    let lx = Math.min(Math.max(m.x, w / 2 + 10), o.s - 10 - w / 2);
    lx = Math.min(Math.max(lx, m.x - maxShift), m.x + maxShift);
    const x0 = lx - w / 2;
    const x1 = lx + w / 2;

    // Prefer the side the marker leans toward; on-axis markers prefer above.
    const prefSide = m.y > axisY ? 1 : 0;
    let placed = false;
    outer: for (let row = 0; row < 4 && !placed; row++) {
      for (const side of [prefSide, 1 - prefSide]) {
        const rows = occupied[side];
        if (row >= rows.length) continue;
        if (!fits(rows[row], x0 - LABEL_GAP, x1 + LABEL_GAP)) continue;
        // Leader must pass cleanly through nearer rows on this side.
        let clear = true;
        for (let k = 0; k < row; k++) {
          if (!fits(rows[k], m.x - LEADER_HALF, m.x + LEADER_HALF)) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;
        rows[row].push({ a: x0 - LABEL_GAP, b: x1 + LABEL_GAP, slug: m.ev.slug });
        for (let k = 0; k < row; k++)
          rows[k].push({ a: m.x - LEADER_HALF, b: m.x + LEADER_HALF });
        const y = labelRowY(side, row);
        labels.push({
          slug: m.ev.slug,
          cat: m.ev.category,
          imp: m.ev.importance,
          title,
          year: eventYear(m.ev),
          x: lx,
          y,
          w,
          leader:
            side === 0
              ? { x: m.x, y1: y + 10, y2: m.y - m.r - 3 }
              : { x: m.x, y1: m.y + m.r + 3, y2: y - 10 },
        });
        m.labeled = true;
        placed = true;
        break outer;
      }
    }
  }

  return { markers, labels, axisY };
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
  // Overscroll pad: a little breathing room past the world's edges while
  // zoomed in — but it must vanish at fit (z = 1), where span === world and
  // any nonzero pad would leave residual panning slack after FIT. Scale it
  // by (1 - span) so pad === 0 exactly when the whole world is in view.
  const pad = (0.012 / zc + 0.004) * (1 - span);
  return { o: clamp(o, -pad, 1 + pad - span), z: zc };
}

export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}
