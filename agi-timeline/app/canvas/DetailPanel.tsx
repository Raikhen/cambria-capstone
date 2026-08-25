"use client";

/**
 * Detail panel — docked slide-over with the full record for one event.
 * Leads with the human voices: contemporary reactions as attributed quote
 * cards come before the source list.
 */

import { forwardRef, useEffect, useRef, type CSSProperties } from "react";
import type { TimelineEvent } from "@/lib/types";
import {
  CAT_LABEL,
  IMP_LABEL,
  PLATFORM_LABEL,
  SOURCE_TYPE_LABEL,
  fmtEventDate,
} from "./lib";

interface Props {
  ev: TimelineEvent | null;
  index: number;
  total: number;
  onClose: () => void;
  onStep: (dir: -1 | 1) => void;
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

  return (
    <div
      className={`tm-panel${ev ? " open" : ""}`}
      ref={ref}
      role="dialog"
      aria-label={shown ? shown.title : "Event details"}
      aria-hidden={!ev}
      // keep hidden panel out of the tab order
      {...(!ev ? { inert: true } : {})}
    >
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

            <p className="tm-panel-date">{fmtEventDate(shown)}</p>
            <h2 className="tm-panel-title">{shown.title}</h2>
            <p className="tm-panel-summary">{shown.summary}</p>

            {shown.reactions && shown.reactions.length > 0 && (
              <>
                <p className="tm-section-cap">What people said</p>
                <div className="tm-quotes">
                  {shown.reactions.map((r, i) => (
                    <figure key={i} className="tm-quote" style={{ margin: 0 }}>
                      <blockquote
                        className="tm-quote-text"
                        style={{ margin: 0 }}
                      >
                        {r.quote}
                      </blockquote>
                      <figcaption className="tm-quote-meta">
                        <span className="tm-quote-author">{r.author}</span>
                        <span>{PLATFORM_LABEL[r.platform] ?? ""}</span>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          source ↗
                        </a>
                      </figcaption>
                    </figure>
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
