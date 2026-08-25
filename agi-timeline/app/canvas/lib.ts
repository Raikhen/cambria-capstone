/**
 * World-coordinate machinery + scene layout for The Map.
 *
 * Time is mapped onto a single world axis u ∈ [0, 1] through a piecewise-
 * linear density warp: dense stretches of history get more of the axis than
 * sparse ones, so 1943–2011 (34 events) doesn't crush 2023–2026 (~150 events)
 * into a wall of pixels. The warp is purely internal — nothing on screen
 * names or draws its segments. Axis ticks are plain calendar years.
 */

import { CATEGORIES, type Category, type TimelineEvent } from "@/lib/types";

/* ----------------------------------------------------------- time warp */

interface Segment {
  t0: number;
  t1: number;
  u0: number;
  u1: number;
}

const SEGMENT_DEFS: Array<{
  start: [number, number, number];
  end: [number, number, number];
  share: number;
}> = [
  { start: [1943, 0, 1], end: [1974, 0, 1], share: 0.08 },
  { start: [1974, 0, 1], end: [2012, 5, 1], share: 0.12 },
  { start: [2012, 5, 1], end: [2017, 5, 1], share: 0.11 },
  { start: [2017, 5, 1], end: [2022, 10, 30], share: 0.19 },
  { start: [2022, 10, 30], end: [2024, 8, 1], share: 0.22 },
  { start: [2024, 8, 1], end: [2026, 8, 15], share: 0.28 },
];

const SEGMENTS: Segment[] = (() => {
  let u = 0;
  return SEGMENT_DEFS.map((d) => {
    const seg: Segment = {
      t0: Date.UTC(d.start[0], d.start[1], d.start[2]),
      t1: Date.UTC(d.end[0], d.end[1], d.end[2]),
      u0: u,
      u1: u + d.share,
    };
    u += d.share;
    return seg;
  });
})();

const T_MIN = SEGMENTS[0].t0;
const T_MAX = SEGMENTS[SEGMENTS.length - 1].t1;
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

export function timeToU(t: number): number {
  const tc = Math.min(Math.max(t, T_MIN), T_MAX);
  for (const e of SEGMENTS) {
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
  for (const e of SEGMENTS) {
    if (uc <= e.u1) return e.t0 + ((uc - e.u0) / (e.u1 - e.u0)) * (e.t1 - e.t0);
  }
  return T_MAX;
}

function segAtU(u: number): Segment {
  for (const e of SEGMENTS) if (u <= e.u1) return e;
  return SEGMENTS[SEGMENTS.length - 1];
}

/** Local pixel density of calendar time at world position u, scale s px/unit. */
export function pxPerYearAt(u: number, s: number): number {
  const seg = segAtU(u);
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
export function genTicks(uFrom: number, uTo: number, s: number): Tick[] {
  const ticks: Tick[] = [];
  const MIN_PX = 82;

  for (const seg of SEGMENTS) {
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
      const y0 = new Date(seg.t0).getUTCFullYear();
      const y1 = new Date(seg.t1).getUTCFullYear();
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
        const t = Date.UTC(y, 0, 1);
        if (t < seg.t0 || t > seg.t1) continue;
        const u = timeToU(t);
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
export function minimapScale(): Tick[] {
  const candidates = [
    1950, 1960, 1970, 1980, 1990, 2000, 2010, 2015,
    2018, 2020, 2022, 2023, 2024, 2025, 2026,
  ];
  const out: Tick[] = [];
  for (const y of candidates) {
    const u = timeToU(Date.UTC(y, 0, 1));
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
export function fmtCursorDate(u: number, s: number): string {
  const ppy = pxPerYearAt(u, s);
  const dt = new Date(uToTime(u));
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
 * scene at the current scale: beeswarm marker rows around a single axis,
 * label chips fitted into horizontal tracks above/below the swarm (leader
 * lines reserved so nothing is crossed), and quote cards fitted into outer
 * tracks near the stage edges. Anything that doesn't fit is dropped, in
 * strict importance-then-recency priority. Deterministic for a given input.
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

export interface SceneCard {
  ev: TimelineEvent;
  /** Left / top of the card track slot (cards are anchored toward the axis). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0 = above the axis, 1 = below. */
  side: 0 | 1;
  leader: { x: number; y1: number; y2: number };
}

export interface Scene {
  markers: SceneMarker[];
  labels: SceneLabel[];
  cards: SceneCard[];
  axisY: number;
}

export interface SceneOpts {
  /** World scale, px per unit. */
  s: number;
  /** Stage size. */
  w: number;
  h: number;
  /** Height of the top tick ruler. */
  axisH: number;
  /** Minimum importance eligible for a static label. */
  tier: number;
  /** Show ambient quote cards for in-view events with reactions. */
  ambient: boolean;
  /** Visible world range (used to pick ambient card candidates). */
  viewU0: number;
  viewU1: number;
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
export const CARD_W = 300;
export const CARD_H = 122;

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
    const u = dateToU(ev.date);
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

  /* ---- geometry of the label + card tracks ---- */
  // On short stages, quote cards go compact (2-line clamp) so label rows
  // and cards can coexist around the axis.
  const compact = (o.h - o.axisH) * 0.5 < 240;
  const cardH = compact ? 84 : CARD_H;
  // Cards hug the axis band (composition stays tight on tall stages) but
  // never leave the stage.
  const REACH = 196;
  const cardTopAbove = Math.max(o.axisH + 12, axisY - REACH - cardH);
  const cardTopBelow = Math.min(o.h - cardH - 12, axisY + REACH);
  const labelBase = SWARM_ZONE + 14; // first label row center, from axis

  // How many label rows fit per side, leaving room for the card track.
  const roomAbove = axisY - labelBase - (cardTopAbove + cardH + 18);
  const roomBelow = cardTopBelow - 18 - (axisY + labelBase);
  const rowsAbove = Math.max(1, Math.min(4, Math.floor(roomAbove / LABEL_ROW_H) + 1));
  const rowsBelow = Math.max(1, Math.min(4, Math.floor(roomBelow / LABEL_ROW_H) + 1));
  const cardRoomAbove = cardTopAbove + cardH + 8 < axisY - SWARM_ZONE;
  const cardRoomBelow = cardTopBelow > axisY + SWARM_ZONE + 8;

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

  /* ---- quote cards: the crowd commenting on history.
   * Placed in two phases around the labels: the selected event's card and
   * major voices (importance ≥ 4) claim space first, remaining voices
   * squeeze into whatever is left after labels. ---- */
  const cards: SceneCard[] = [];
  const cardW = Math.min(CARD_W, o.w - 32);
  const cardRows: Interval[][] = [[], []]; // above, below
  const px0 = o.viewU0 * o.s;
  const px1 = o.viewU1 * o.s;
  const margin = (px1 - px0) * 0.15;

  let cardCands: SceneMarker[] = [];
  if (o.ambient) {
    cardCands = markers
      .filter(
        (m) =>
          m.ev.reactions &&
          m.ev.reactions.length > 0 &&
          m.x >= px0 - margin &&
          m.x <= px1 + margin,
      )
      .sort((a, b) =>
        b.ev.importance !== a.ev.importance
          ? b.ev.importance - a.ev.importance
          : b.ev.date < a.ev.date
            ? -1
            : 1,
      )
      .slice(0, 14);
  }
  if (o.selectedSlug) {
    const sel = bySlug.get(o.selectedSlug);
    if (sel && sel.ev.reactions && sel.ev.reactions.length > 0) {
      cardCands = [sel, ...cardCands.filter((m) => m !== sel)];
    }
  }

  // A card's vertical band can intersect label rows on short stages: where
  // it does, the card must clear (and then reserves) the full card width in
  // those rows; rows between the band and the axis only need leader passage.
  const tryCardSide = (
    m: SceneMarker,
    side: 0 | 1,
    x0: number,
    x1: number,
  ): boolean => {
    const bandTop = side === 0 ? cardTopAbove : cardTopBelow;
    const bandBot = bandTop + cardH;
    if (!fits(cardRows[side], x0 - 18, x1 + 18)) return false;
    const rows = occupied[side];
    const spans: Array<{ k: number; a: number; b: number } | null> = [];
    for (let k = 0; k < rows.length; k++) {
      const yc = labelRowY(side, k);
      const intersects = yc - 11 < bandBot && yc + 11 > bandTop;
      const between = side === 0 ? yc - 11 >= bandBot : yc + 11 <= bandTop;
      if (intersects) {
        if (!fits(rows[k], x0 - 8, x1 + 8)) return false;
        spans.push({ k, a: x0 - 8, b: x1 + 8 });
      } else if (between) {
        // Leader passes this row — allowed behind this event's own label.
        if (!fits(rows[k], m.x - LEADER_HALF, m.x + LEADER_HALF, m.ev.slug))
          return false;
        spans.push({ k, a: m.x - LEADER_HALF, b: m.x + LEADER_HALF });
      } else {
        spans.push(null);
      }
    }
    cardRows[side].push({ a: x0 - 18, b: x1 + 18 });
    for (const sp of spans) if (sp) rows[sp.k].push({ a: sp.a, b: sp.b });
    return true;
  };

  let cardIdx = 0;
  const placeCard = (m: SceneMarker): void => {
    // Shift cards of events near the world's edges inward, leader permitting.
    const maxShift = Math.max(0, cardW / 2 - 14);
    let cx = Math.min(Math.max(m.x, cardW / 2 + 2), o.s - 2 - cardW / 2);
    cx = Math.min(Math.max(cx, m.x - maxShift), m.x + maxShift);
    const x0 = cx - cardW / 2;
    const x1 = cx + cardW / 2;
    let done = false;
    // Alternate the preferred side so the commentary flanks the line.
    const pref: Array<0 | 1> = cardIdx % 2 === 0 ? [1, 0] : [0, 1];
    for (const side of pref) {
      if (side === 0 && !cardRoomAbove) continue;
      if (side === 1 && !cardRoomBelow) continue;
      if (!tryCardSide(m, side, x0, x1)) continue;
      const y = side === 0 ? cardTopAbove : cardTopBelow;
      cards.push({
        ev: m.ev,
        x: x0,
        y,
        w: cardW,
        h: cardH,
        side,
        leader:
          side === 0
            ? { x: m.x, y1: y + cardH, y2: m.y - m.r - 3 }
            : { x: m.x, y1: m.y + m.r + 3, y2: y },
      });
      cardIdx++;
      done = true;
      break;
    }
    if (!done && m.ev.slug === o.selectedSlug && cardRoomBelow) {
      // The selected card must appear: give it the below track at the
      // nearest position that clears everything (shift horizontally).
      const step = 24;
      for (let d = 0; d <= 40; d++) {
        let placedSel = false;
        for (const dir of d === 0 ? [0] : [-1, 1]) {
          const cx = m.x + dir * d * step;
          if (tryCardSide(m, 1, cx - cardW / 2, cx + cardW / 2)) {
            cards.push({
              ev: m.ev,
              x: cx - cardW / 2,
              y: cardTopBelow,
              w: cardW,
              h: cardH,
              side: 1,
              leader: { x: m.x, y1: m.y + m.r + 3, y2: cardTopBelow },
            });
            placedSel = true;
            break;
          }
        }
        if (placedSel) break;
      }
    }
  };

  const isPriorityCard = (m: SceneMarker) =>
    m.ev.slug === o.selectedSlug || m.ev.importance >= 4;
  for (const m of cardCands) if (isPriorityCard(m)) placeCard(m);

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
    let lx = Math.min(Math.max(m.x, w / 2 + 2), o.s - 2 - w / 2);
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

  /* ---- phase 2: remaining voices squeeze into leftover space ---- */
  for (const m of cardCands) if (!isPriorityCard(m)) placeCard(m);

  return { markers, labels, cards, axisY };
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
