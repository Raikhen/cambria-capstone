"use client";

/**
 * Detail panel — docked slide-over with the full record for one event.
 * Leads with the human voices: contemporary reactions (official X/Substack
 * embeds where possible, attributed quote cards otherwise) come before the
 * source list.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { TimelineEvent } from "@/lib/types";
import {
  CAT_LABEL,
  IMP_LABEL,
  SOURCE_TYPE_LABEL,
  fmtEventDate,
} from "./lib";
import Reaction from "./ReactionEmbed";

interface Props {
  ev: TimelineEvent | null;
  index: number;
  total: number;
  onClose: () => void;
  onStep: (dir: -1 | 1) => void;
}

const PANEL_W_KEY = "tm-panel-w";
const PANEL_MIN_W = 320;

function clampPanelWidth(w: number) {
  return Math.round(
    Math.min(Math.max(w, PANEL_MIN_W), Math.min(860, window.innerWidth * 0.92)),
  );
}

const DetailPanel = forwardRef<HTMLDivElement, Props>(function DetailPanel(
  { ev, index, total, onClose, onStep },
  ref,
) {
  // Keep rendering the last event during the slide-out transition.
  const lastRef = useRef<TimelineEvent | null>(null);
  if (ev) lastRef.current = ev;
  const shown = ev ?? lastRef.current;

  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ev) bodyRef.current?.scrollTo({ top: 0 });
  }, [ev]);

  // Resizable width (desktop slide-over only; the mobile bottom sheet
  // overrides width in CSS). null = default width from the stylesheet.
  const [width, setWidth] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem(PANEL_W_KEY) ?? "", 10);
      if (Number.isFinite(saved)) setWidth(clampPanelWidth(saved));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const saveWidth = (w: number | null) => {
    try {
      if (w === null) localStorage.removeItem(PANEL_W_KEY);
      else localStorage.setItem(PANEL_W_KEY, String(w));
    } catch {
      /* storage unavailable */
    }
  };

  const onResizeStart = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing(true);
    document.documentElement.classList.add("tm-resizing-x");
    let w: number | null = null;
    const onMove = (me: PointerEvent) => {
      w = clampPanelWidth(window.innerWidth - me.clientX);
      setWidth(w);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setResizing(false);
      document.documentElement.classList.remove("tm-resizing-x");
      if (w !== null) saveWidth(w);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

  const onResizeKey = useCallback((e: ReactKeyboardEvent) => {
    const step = e.key === "ArrowLeft" ? 24 : e.key === "ArrowRight" ? -24 : 0;
    if (!step) return;
    e.preventDefault();
    setWidth((prev) => {
      const w = clampPanelWidth((prev ?? 420) + step);
      saveWidth(w);
      return w;
    });
  }, []);

  const resetWidth = useCallback(() => {
    setWidth(null);
    saveWidth(null);
  }, []);

  return (
    <div
      className={`tm-panel${ev ? " open" : ""}${resizing ? " resizing" : ""}`}
      style={
        width !== null
          ? ({ "--tm-panel-w": `${width}px` } as CSSProperties)
          : undefined
      }
      ref={ref}
      role="dialog"
      aria-label={shown ? shown.title : "Event details"}
      aria-hidden={!ev}
      // keep hidden panel out of the tab order
      {...(!ev ? { inert: true } : {})}
    >
      <div
        className="tm-panel-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel (double-click to reset)"
        tabIndex={ev ? 0 : -1}
        onPointerDown={onResizeStart}
        onKeyDown={onResizeKey}
        onDoubleClick={resetWidth}
      />
      {shown && (
        <>
          <div className="tm-panel-head">
            <div className="tm-panel-nav">
              <button
                aria-label="Previous event"
                disabled={index <= 0}
                onClick={() => onStep(-1)}
              >
                ‹
              </button>
              <button
                aria-label="Next event"
                disabled={index < 0 || index >= total - 1}
                onClick={() => onStep(1)}
              >
                ›
              </button>
            </div>
            <span className="tm-panel-pos">
              {index >= 0 ? `${index + 1} / ${total}` : ""}
            </span>
            <div className="tm-bar-spacer" />
            <button
              className="tm-panel-close"
              aria-label="Close details"
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          <div className="tm-panel-body" ref={bodyRef}>
            <header className={shown.image ? "tm-head-cover" : undefined}>
              {shown.image && (
                <img
                  className="tm-cover-img"
                  src={shown.image.url}
                  // credit rides along in alt/tooltip instead of on-screen
                  alt={
                    shown.image.credit
                      ? `${shown.image.alt} — ${shown.image.credit}`
                      : shown.image.alt
                  }
                  title={
                    [shown.image.caption, shown.image.credit]
                      .filter(Boolean)
                      .join(" — ") || undefined
                  }
                  loading="lazy"
                />
              )}
              <div className="tm-meta-row">
              <span
                className="tm-cat-tag"
                style={{ "--c": `var(--tm-cat-${shown.category})` } as CSSProperties}
              >
                <i aria-hidden />
                {CAT_LABEL[shown.category]}
              </span>
              {shown.secondary_category && (
                <span
                  className="tm-cat-tag secondary"
                  style={
                    {
                      "--c": `var(--tm-cat-${shown.secondary_category})`,
                    } as CSSProperties
                  }
                >
                  <i aria-hidden />
                  {CAT_LABEL[shown.secondary_category]}
                </span>
              )}
              <span
                className="tm-imp-badge"
                title={`Importance ${shown.importance} of 5`}
              >
                <span className="tm-imp-pips" aria-hidden>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} className={n <= shown.importance ? "on" : ""} />
                  ))}
                </span>
                {IMP_LABEL[shown.importance] ?? shown.importance}
              </span>
              </div>

              <div className="tm-head-text">
                <p className="tm-panel-date">{fmtEventDate(shown)}</p>
                <h2 className="tm-panel-title">{shown.title}</h2>
              </div>
            </header>

            <p className="tm-panel-summary">{shown.summary}</p>

            {shown.reactions && shown.reactions.length > 0 && (
              <>
                <p className="tm-section-cap">
                  What people said
                  {shown.reactions.length > 1 && (
                    <span className="tm-section-n">
                      {shown.reactions.length}
                    </span>
                  )}
                </p>
                <div className="tm-quotes">
                  {shown.reactions.map((r, i) => (
                    <Reaction key={`${r.url}${i}`} r={r} />
                  ))}
                </div>
              </>
            )}

            <p className="tm-section-cap">Sources</p>
            <ul className="tm-sources">
              {shown.sources.map((src, i) => (
                <li
                  key={`${src.url}${i}`}
                  className={`tm-source${i === 0 ? " primary" : ""}`}
                >
                  <a href={src.url} target="_blank" rel="noopener noreferrer">
                    <span className="tm-source-type">
                      {i === 0 ? "Primary" : SOURCE_TYPE_LABEL[src.type] ?? src.type}
                    </span>
                    <span className="tm-source-title">
                      {src.title}
                      {src.author ? ` — ${src.author}` : ""}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
});

export default DetailPanel;
