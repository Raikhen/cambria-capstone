"use client";

/**
 * The Map — a zoomable, pannable chart of AI history on a single axis.
 *
 * World model: time is warped onto u ∈ [0,1] (see lib.ts). The viewport is
 * {o, z}: world-u at the left edge, and zoom factor (viewport shows 1/z of
 * the world). Pan is a single GPU transform on the world layer; zoom
 * recomputes the collision-resolved scene (markers, labels, quote cards).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CATEGORIES, type Category, type TimelineEvent } from "@/lib/types";
import {
  CAT_LABEL,
  clampView,
  dateToU,
  easeOutQuart,
  fmtCursorDate,
  fmtEventDate,
  genTicks,
  labelTier,
  layoutScene,
  pxPerYearAt,
  type View,
} from "./lib";
import Minimap from "./Minimap";
import DetailPanel from "./DetailPanel";

const AXIS_H = 30;

/* ------------------------------------------------------- text measurement */

let measureCtx: CanvasRenderingContext2D | null = null;
function getCtx(): CanvasRenderingContext2D | null {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  return measureCtx;
}

interface Props {
  events: TimelineEvent[];
  initialCats: Category[];
  initialMin: number;
}

export default function TheMap({ events, initialCats, initialMin }: Props) {
  /* ------------------------------------------------------------ state */
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ o: 0, z: 1 });
  const [cats, setCats] = useState<Category[]>(initialCats);
  const [minImp, setMinImp] = useState(initialMin);
  const [selected, setSelected] = useState<string | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [families, setFamilies] = useState<{ ui: string; mono: string } | null>(
    null,
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const crossRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);

  const dimsRef = useRef(dims);
  dimsRef.current = dims;
  const viewRef = useRef(view);
  viewRef.current = view;

  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{
    mode: "pan" | "pinch" | null;
    startX: number;
    o0: number;
    moved: number;
    pinchD0: number;
    pinchZ0: number;
    pinchU: number;
  }>({ mode: null, startX: 0, o0: 0, moved: 0, pinchD0: 0, pinchZ0: 1, pinchU: 0 });
  const suppressClickRef = useRef(false);
  const animRef = useRef<number | null>(null);

  /* --------------------------------------------------- layout plumbing */

  // Full-bleed setup: measure the site header, lock document scroll.
  useEffect(() => {
    const header = document.querySelector("body > header");
    const root = rootRef.current;
    const setNav = () => {
      if (root && header instanceof HTMLElement) {
        root.style.setProperty("--tm-topnav", `${header.offsetHeight}px`);
      }
    };
    setNav();
    window.addEventListener("resize", setNav);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", setNav);
      html.style.overflow = prev;
    };
  }, []);

  // Dev-only hook so tests / tooling can drive the viewport deterministically.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as Record<string, unknown>;
    w.__tmGoto = (o: number, z: number) => setView(clampView(o, z));
    w.__tmSelect = (slug: string | null) => setSelected(slug);
    return () => {
      delete w.__tmGoto;
      delete w.__tmSelect;
    };
  }, []);

  // Stage size.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setDims({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Font families for canvas text measurement; re-measure once fonts load.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cs = getComputedStyle(root);
    const ui = cs.getPropertyValue("--tm-font-u").trim() || "sans-serif";
    const mono = cs.getPropertyValue("--tm-font-m").trim() || "monospace";
    setFamilies({ ui, mono });
    let alive = true;
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (alive) setFontTick((t) => t + 1);
      });
    }
    return () => {
      alive = false;
    };
  }, []);

  const measure = useMemo(() => {
    // fontTick invalidates the cache once webfonts finish loading.
    void fontTick;
    const cache = new Map<string, number>();
    const ui = (text: string, px: number, weight: number) => {
      const key = `u${weight}|${px}|${text}`;
      let w = cache.get(key);
      if (w === undefined) {
        const ctx = getCtx();
        if (!ctx || !families) return text.length * px * 0.55;
        ctx.font = `${weight} ${px}px ${families.ui}`;
        w = ctx.measureText(text).width;
        cache.set(key, w);
      }
      return w;
    };
    const mono = (text: string, px: number) => {
      const key = `m${px}|${text}`;
      let w = cache.get(key);
      if (w === undefined) {
        const ctx = getCtx();
        if (!ctx || !families) return text.length * px * 0.62;
        ctx.font = `500 ${px}px ${families.mono}`;
        w = ctx.measureText(text).width;
        cache.set(key, w);
      }
      return w;
    };
    return { ui, mono };
  }, [families, fontTick]);

  /* ----------------------------------------------------------- filters */

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (ev.importance < minImp) return false;
      if (cats.length === CATEGORIES.length) return true;
      return (
        cats.includes(ev.category) ||
        (ev.secondary_category != null && cats.includes(ev.secondary_category))
      );
    });
  }, [events, cats, minImp]);

  // Shareable URL state.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (cats.length < CATEGORIES.length) p.set("cats", cats.join(","));
    else p.delete("cats");
    if (minImp > 1) p.set("min", String(minImp));
    else p.delete("min");
    const qs = p.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
  }, [cats, minImp]);

  /* ------------------------------------------------------ view helpers */

  const stopAnim = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const animateTo = useCallback(
    (o2: number, z2: number) => {
      stopAnim();
      const target = clampView(o2, z2);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setView(target);
        return;
      }
      const from = viewRef.current;
      const c0 = from.o + 0.5 / from.z;
      const c1 = target.o + 0.5 / target.z;
      const lz0 = Math.log(from.z);
      const lz1 = Math.log(target.z);
      const t0 = performance.now();
      const DUR = 420;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / DUR);
        const e = easeOutQuart(t);
        const z = Math.exp(lz0 + (lz1 - lz0) * e);
        const c = c0 + (c1 - c0) * e;
        setView(clampView(c - 0.5 / z, z));
        if (t < 1) animRef.current = requestAnimationFrame(step);
        else animRef.current = null;
      };
      animRef.current = requestAnimationFrame(step);
    },
    [stopAnim],
  );

  const zoomCenter = useCallback(
    (factor: number) => {
      const v = viewRef.current;
      const c = v.o + 0.5 / v.z;
      const z2 = v.z * factor;
      animateTo(c - 0.5 / Math.min(Math.max(z2, 1), 200), z2);
      setInteracted(true);
    },
    [animateTo],
  );

  const fitAll = useCallback(() => {
    animateTo(0, 1);
    setInteracted(true);
  }, [animateTo]);

  const ensureVisible = useCallback(
    (u: number) => {
      const v = viewRef.current;
      const span = 1 / v.z;
      if (u < v.o + span * 0.06 || u > v.o + span * 0.94) {
        animateTo(u - span / 2, v.z);
      }
    },
    [animateTo],
  );

  /* ----------------------------------------------------- pointer input */

  const onStagePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stopAnim();
      setInteracted(true);
      const pts = pointersRef.current;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gestureRef.current;
      if (pts.size === 1) {
        g.mode = "pan";
        g.startX = e.clientX;
        g.o0 = viewRef.current.o;
        g.moved = 0;
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        g.mode = "pinch";
        g.pinchD0 = Math.max(20, Math.abs(a.x - b.x));
        g.pinchZ0 = viewRef.current.z;
        const rect = stageRef.current!.getBoundingClientRect();
        const midPx = (a.x + b.x) / 2 - rect.left;
        g.pinchU =
          viewRef.current.o + midPx / (viewRef.current.z * dimsRef.current.w);
      }
    },
    [stopAnim],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const pts = pointersRef.current;
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gestureRef.current;
      const W = dimsRef.current.w || 1;
      if (g.mode === "pan" && pts.size === 1) {
        const dx = e.clientX - g.startX;
        g.moved = Math.max(g.moved, Math.abs(dx));
        if (g.moved > 3) {
          suppressClickRef.current = true;
          stageRef.current?.classList.add("is-panning");
        }
        setView((v) => clampView(g.o0 - dx / (v.z * W), v.z));
      } else if (g.mode === "pinch" && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.max(20, Math.abs(a.x - b.x));
        const z2 = g.pinchZ0 * (d / g.pinchD0);
        const rect = stageRef.current?.getBoundingClientRect();
        if (!rect) return;
        const midPx = (a.x + b.x) / 2 - rect.left;
        const zc = Math.min(Math.max(z2, 1), 200);
        setView(clampView(g.pinchU - midPx / (zc * W), z2));
        suppressClickRef.current = true;
      }
    };
    const up = (e: PointerEvent) => {
      const pts = pointersRef.current;
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      const g = gestureRef.current;
      if (pts.size === 0) {
        g.mode = null;
        stageRef.current?.classList.remove("is-panning");
        // allow the click that follows this pointerup to be evaluated first
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      } else if (pts.size === 1) {
        const [rest] = [...pts.values()];
        g.mode = "pan";
        g.startX = rest.x;
        g.o0 = viewRef.current.o;
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  // Wheel: zoom (vertical / pinch-gesture), pan (horizontal).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopAnim();
      setInteracted(true);
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const W = dimsRef.current.w || 1;
      if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        setView((v) => clampView(v.o + e.deltaX / (v.z * W), v.z));
      } else {
        const k = e.ctrlKey ? 0.012 : e.deltaMode === 1 ? 0.06 : 0.0024;
        const factor = Math.exp(-e.deltaY * k);
        setView((v) => {
          const u = v.o + px / (v.z * W);
          const z2 = v.z * factor;
          const zc = Math.min(Math.max(z2, 1), 200);
          return clampView(u - px / (zc * W), z2);
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stopAnim]);

  const onStageDoubleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const rect = stageRef.current!.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const v = viewRef.current;
      const W = dimsRef.current.w || 1;
      const u = v.o + px / (v.z * W);
      const z2 = Math.min(v.z * 2.2, 200);
      animateTo(u - px / (z2 * W), z2);
    },
    [animateTo],
  );

  // Crosshair + date readout: direct DOM writes, no re-render.
  const onStagePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse") return;
      const stage = stageRef.current;
      const cross = crossRef.current;
      const readout = readoutRef.current;
      if (!stage || !cross || !readout) return;
      const rect = stage.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const v = viewRef.current;
      const W = dimsRef.current.w || 1;
      const u = v.o + px / (v.z * W);
      stage.classList.add("has-cursor");
      cross.style.transform = `translateX(${px}px)`;
      readout.style.left = `${Math.min(Math.max(px, 46), W - 46)}px`;
      readout.textContent = fmtCursorDate(u, v.z * W);
    },
    [],
  );
  const onStagePointerLeave = useCallback(() => {
    stageRef.current?.classList.remove("has-cursor");
  }, []);

  /* ---------------------------------------------------------- keyboard */

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const inPanel = panelRef.current?.contains(e.target as Node);
      if (e.key === "Escape") {
        if (selected) {
          setSelected(null);
          e.preventDefault();
        }
        return;
      }
      if (inPanel) return;
      const v = viewRef.current;
      const W = dimsRef.current.w || 1;
      const panPx = e.shiftKey ? 400 : 140;
      switch (e.key) {
        case "ArrowLeft":
          setView(clampView(v.o - panPx / (v.z * W), v.z));
          setInteracted(true);
          e.preventDefault();
          break;
        case "ArrowRight":
          setView(clampView(v.o + panPx / (v.z * W), v.z));
          setInteracted(true);
          e.preventDefault();
          break;
        case "+":
        case "=":
          zoomCenter(1.6);
          e.preventDefault();
          break;
        case "-":
        case "_":
          zoomCenter(1 / 1.6);
          e.preventDefault();
          break;
        case "0":
          fitAll();
          e.preventDefault();
          break;
        case "Home":
          animateTo(0, v.z);
          e.preventDefault();
          break;
        case "End":
          animateTo(1 - 1 / v.z, v.z);
          e.preventDefault();
          break;
      }
    },
    [selected, zoomCenter, fitAll, animateTo],
  );

  /* --------------------------------------------------------- rendering */

  const s = Math.max(1, view.z * dims.w);

  // Ticks + scene are computed over a padded, quantized window so small pans
  // don't rebuild them every frame.
  const span = 1 / view.z;
  const quantO = Math.floor(view.o / (span * 0.5)) * (span * 0.5);
  const ticks = useMemo(
    () => genTicks(quantO - span * 0.75, quantO + span * 2.25, s),
    [quantO, span, s],
  );

  const selectedEv = useMemo(
    () => (selected ? filtered.find((e) => e.slug === selected) ?? null : null),
    [selected, filtered],
  );

  // If the selected event gets filtered away, drop the selection entirely so
  // the panel doesn't surprise-reopen when the filter comes back.
  useEffect(() => {
    if (selected && !filtered.some((e) => e.slug === selected)) {
      setSelected(null);
    }
  }, [selected, filtered]);
  const selIndex = selectedEv ? filtered.indexOf(selectedEv) : -1;

  const centerU = quantO + span * 0.5;
  const ambient = pxPerYearAt(Math.min(Math.max(centerU, 0), 1), s) >= 500;

  // Label tier: zoom-based, but relaxed when filters leave the map sparse —
  // the collision fitter still guarantees nothing overlaps.
  const baseTier = labelTier(view.z);
  const tier =
    filtered.length <= 36
      ? Math.min(baseTier, 3)
      : filtered.length <= 90
        ? Math.min(baseTier, 4)
        : baseTier;

  const scene = useMemo(() => {
    if (dims.w <= 0 || dims.h <= 0) return null;
    return layoutScene(filtered, {
      s,
      w: dims.w,
      h: dims.h,
      axisH: AXIS_H,
      tier,
      ambient,
      viewU0: quantO - span * 0.5,
      viewU1: quantO + span * 1.5,
      selectedSlug: selected,
      measureUi: measure.ui,
      measureMono: measure.mono,
    });
  }, [filtered, s, dims, tier, ambient, quantO, span, selected, measure]);

  const selectSlug = useCallback(
    (slug: string | null) => {
      setSelected(slug);
      if (slug) {
        const ev = events.find((e) => e.slug === slug);
        if (ev) ensureVisible(dateToU(ev.date));
      }
    },
    [events, ensureVisible],
  );

  const guardedSelect = useCallback(
    (slug: string) => {
      if (suppressClickRef.current) return;
      selectSlug(slug);
    },
    [selectSlug],
  );

  const toggleCat = useCallback((c: Category) => {
    setCats((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }, []);

  /* ------------------------------------------------------------ render */

  return (
    <div className="tm-root" ref={rootRef} onKeyDown={onKeyDown}>
      {/* ---- control bar ---- */}
      <div className="tm-bar">
        <div className="tm-wordmark">
          <b>The Map</b>
          <span>1943–2026</span>
        </div>

        <div
          className="tm-bar-group tm-cats"
          role="group"
          aria-label="Filter by category"
        >
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className="tm-chip"
              aria-pressed={cats.includes(c)}
              style={{ "--c": `var(--tm-cat-${c})` } as CSSProperties}
              onClick={() => toggleCat(c)}
            >
              <i aria-hidden />
              {CAT_LABEL[c]}
            </button>
          ))}
        </div>

        <div className="tm-bar-spacer" />

        <div className="tm-imp" role="group" aria-label="Minimum importance">
          <span className="tm-imp-cap" id="tm-imp-cap">
            Min&nbsp;importance
          </span>
          <div className="tm-imp-steps" aria-labelledby="tm-imp-cap">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                aria-pressed={minImp === n}
                aria-label={`Show importance ${n} and above`}
                onClick={() => setMinImp(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="tm-zoom" role="group" aria-label="Zoom">
          <button aria-label="Zoom out" onClick={() => zoomCenter(1 / 1.6)}>
            −
          </button>
          <button aria-label="Zoom in" onClick={() => zoomCenter(1.6)}>
            +
          </button>
          <button className="tm-fit" onClick={fitAll}>
            Fit
          </button>
        </div>

        <span className="tm-count" role="status">
          <b>{filtered.length}</b>/{events.length}
        </span>
      </div>

      {/* ---- stage ---- */}
      <div
        className="tm-stage"
        ref={stageRef}
        tabIndex={0}
        role="region"
        aria-label="Timeline map. Drag to pan, scroll or press plus and minus to zoom, Tab to step through events."
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerLeave={onStagePointerLeave}
        onDoubleClick={onStageDoubleClick}
        // The browser auto-scrolls overflow:hidden containers to reveal
        // focused children, which would desync from our transform — undo it.
        onScroll={(e) => {
          e.currentTarget.scrollLeft = 0;
          e.currentTarget.scrollTop = 0;
        }}
      >
        <div className="tm-ruler" aria-hidden />

        {scene && (
          <>
            {/* the one axis — fixed, horizontal, full width */}
            <div className="tm-axis" style={{ top: scene.axisY }} aria-hidden />

            {/* panning world layer */}
            <div
              className="tm-layer"
              style={{ transform: `translate3d(${-view.o * s}px,0,0)` }}
            >
              {/* gridlines + tick labels */}
              {ticks.map((t) => (
                <div
                  key={`g${t.u}`}
                  className="tm-grid"
                  data-major={t.major || undefined}
                  style={{ left: t.u * s }}
                />
              ))}
              {ticks.map((t) => (
                <span
                  key={`l${t.u}`}
                  className="tm-tick-lbl"
                  data-major={t.major || undefined}
                  style={{ left: t.u * s }}
                >
                  {t.label}
                </span>
              ))}

              {/* leader lines (labels + cards) */}
              {scene.labels.map((l) => (
                <span
                  key={`ld${l.slug}`}
                  className="tm-leader"
                  style={{
                    left: l.leader.x,
                    top: Math.min(l.leader.y1, l.leader.y2),
                    height: Math.max(1, Math.abs(l.leader.y2 - l.leader.y1)),
                  }}
                />
              ))}
              {scene.cards.map((c) => (
                <span
                  key={`cld${c.ev.slug}`}
                  className="tm-leader card"
                  style={{
                    left: c.leader.x,
                    top: Math.min(c.leader.y1, c.leader.y2),
                    height: Math.max(1, Math.abs(c.leader.y2 - c.leader.y1)),
                  }}
                />
              ))}

              {/* markers */}
              {scene.markers.map((m) => (
                <button
                  key={m.ev.slug}
                  className="tm-mark"
                  data-imp={m.ev.importance}
                  data-sel={selected === m.ev.slug || undefined}
                  style={
                    {
                      left: m.x,
                      top: m.y,
                      "--c": `var(--tm-cat-${m.ev.category})`,
                      "--r": `${m.r * 2}px`,
                    } as CSSProperties
                  }
                  onClick={() => guardedSelect(m.ev.slug)}
                  onFocus={() => ensureVisible(m.u)}
                  aria-label={`${m.ev.title} — ${fmtEventDate(m.ev)} — ${CAT_LABEL[m.ev.category]}, importance ${m.ev.importance} of 5`}
                >
                  <span className="tm-hit" aria-hidden />
                  <span className="tm-dot" aria-hidden />
                  <span
                    className={`tm-hover${m.y <= scene.axisY ? " below" : ""}`}
                    aria-hidden
                  >
                    <b>{m.ev.title}</b>
                    <i>{fmtEventDate(m.ev)}</i>
                  </span>
                </button>
              ))}

              {/* static labels */}
              {scene.labels.map((l) => (
                <div
                  key={l.slug}
                  className="tm-lbl"
                  aria-hidden
                  data-imp={l.imp}
                  data-sel={selected === l.slug || undefined}
                  style={
                    {
                      left: l.x,
                      top: l.y,
                      "--c": `var(--tm-cat-${l.cat})`,
                    } as CSSProperties
                  }
                  onClick={() => guardedSelect(l.slug)}
                >
                  <b>{l.title}</b>
                  <i>{l.year}</i>
                </div>
              ))}

              {/* quote cards — the crowd commenting on history */}
              {scene.cards.map((c) => {
                const r = c.ev.reactions![0];
                return (
                  <figure
                    key={`c${c.ev.slug}`}
                    className={`tm-card${c.h < 100 ? " compact" : ""}`}
                    data-sel={selected === c.ev.slug || undefined}
                    style={
                      c.side === 0
                        ? { left: c.x, bottom: dims.h - (c.y + c.h), width: c.w }
                        : { left: c.x, top: c.y, width: c.w }
                    }
                    onClick={() => guardedSelect(c.ev.slug)}
                  >
                    <blockquote>{r.quote}</blockquote>
                    <figcaption>
                      <b>{r.author}</b>
                      <span>
                        on {c.ev.title.length > 34 ? `${c.ev.title.slice(0, 33)}…` : c.ev.title}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>

            <div className="tm-cross" ref={crossRef} aria-hidden />
            <div className="tm-readout" ref={readoutRef} aria-hidden />

            {filtered.length === 0 && (
              <div className="tm-empty">
                <div>
                  <p>Nothing charted here</p>
                  <span>
                    Re-enable a category or lower the importance floor to
                    bring the record back.
                  </span>
                </div>
              </div>
            )}

            {!interacted && filtered.length > 0 && scene.cards.length === 0 && (
              <div className="tm-hint" aria-hidden>
                drag to pan · scroll to zoom · <kbd>+</kbd>/<kbd>−</kbd> ·{" "}
                <kbd>0</kbd> fits
              </div>
            )}
          </>
        )}
      </div>

      {/* ---- minimap ---- */}
      <Minimap
        filtered={filtered}
        view={view}
        onNavigate={(o) => {
          stopAnim();
          setInteracted(true);
          setView((v) => clampView(o, v.z));
        }}
      />

      {/* ---- detail panel ---- */}
      <DetailPanel
        ref={panelRef}
        ev={selectedEv}
        index={selIndex}
        total={filtered.length}
        onClose={() => setSelected(null)}
        onStep={(dir) => {
          const next = filtered[selIndex + dir];
          if (next) selectSlug(next.slug);
        }}
      />
    </div>
  );
}
