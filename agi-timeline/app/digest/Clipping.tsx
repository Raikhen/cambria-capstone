"use client";

/**
 * The "clipping" — full detail for one dispatch, pulled out of the page like
 * a cutting from the archive. Sources (primary first), verbatim commentary,
 * placement note, editor's note. Escape or the scrim closes it.
 */

import { useEffect, useRef, type CSSProperties } from "react";
import type { TimelineEvent } from "@/lib/types";
import {
  CATEGORY_META,
  PLATFORM_LABEL,
  SOURCE_TYPE_LABEL,
  formatEventDate,
  placementLabel,
} from "./issues";

interface Props {
  event: TimelineEvent;
  onClose: () => void;
}

export default function Clipping({ event, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      // minimal focus trap: keep Tab inside the panel
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const sectionStyle = {
    "--sec": `var(${CATEGORY_META[event.category].cssVar})`,
  } as CSSProperties;

  return (
    <>
      <div className="dg-scrim" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        className="dg-clipping"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dg-clipping-title"
        style={sectionStyle}
      >
        <div className="px-6 py-6 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <p className="dg-kicker pt-1.5">
              {CATEGORY_META[event.category].label}
              {event.secondary_category && (
                <span className="opacity-75">
                  {" · "}
                  {CATEGORY_META[event.secondary_category].label}
                </span>
              )}
            </p>
            <button
              ref={closeRef}
              type="button"
              className="dg-close shrink-0"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <h2 id="dg-clipping-title" className="dg-clip-hed mt-3">
            {event.title}
          </h2>

          <p className="dg-dateline mt-3">
            {formatEventDate(event)}
            <span aria-hidden> — </span>
            <span style={{ color: "var(--sec)" }}>
              {placementLabel(event.importance)}
            </span>
          </p>

          <div className="dg-rule-strong mt-4" />

          <p className="dg-body mt-4 text-[1.02rem]">{event.summary}</p>

          {event.importance_rationale && (
            <p className="dg-body mt-4 border-l-2 border-[var(--rule-strong)] pl-3 text-[0.85rem] italic">
              <span className="dg-eyebrow mr-2 not-italic">
                Editor&rsquo;s note
              </span>
              {event.importance_rationale}
            </p>
          )}

          {event.reactions && event.reactions.length > 0 && (
            <section className="mt-8" aria-label="Commentary">
              <p className="dg-eyebrow">The commentary</p>
              <div className="mt-3 space-y-5">
                {event.reactions.map((reaction, i) => (
                  <figure key={i} className="dg-quote-card">
                    <blockquote>{reaction.quote}</blockquote>
                    <figcaption className="mt-2 font-[family-name:var(--font-label)] text-[0.72rem]">
                      <span className="font-bold">{reaction.author}</span>{" "}
                      <a
                        className="dg-link"
                        href={reaction.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {PLATFORM_LABEL[reaction.platform] ?? "elsewhere"} ↗
                      </a>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8 pb-2" aria-label="Sources">
            <p className="dg-eyebrow">Sources</p>
            <ol className="mt-3 space-y-2.5">
              {event.sources.map((source, i) => (
                <li
                  key={i}
                  className="font-[family-name:var(--font-label)] text-[0.78rem] leading-snug"
                >
                  <a
                    className="dg-link font-semibold"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.title}
                  </a>
                  <span className="text-[var(--ink-faint)]">
                    {" · "}
                    {SOURCE_TYPE_LABEL[source.type] ?? source.type}
                    {source.author ? ` · ${source.author}` : ""}
                    {i === 0 ? " · primary" : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
