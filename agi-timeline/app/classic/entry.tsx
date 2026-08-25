"use client";

/**
 * Event entries for The Chronicle, scaled by importance:
 *   5 — landmark spread: everything visible, reactions as a card grid.
 *   4 — major: summary + primary source visible, reactions expandable.
 *   3 — notable: summary visible, sources + reactions expandable.
 *   2 — footnote: one line, everything expandable.
 */

import type { EventReaction, EventSource, TimelineEvent } from "@/lib/types";
import {
  CATEGORY_META,
  PLATFORM_LABEL,
  domainOf,
  formatEventDate,
} from "./lib";

function Tag({
  cat,
  secondary,
}: {
  cat: TimelineEvent["category"];
  secondary?: boolean;
}) {
  return (
    <span
      className={`ch-tag${secondary ? " ch-tag--secondary" : ""}`}
      data-cat={cat}
    >
      {CATEGORY_META[cat].label}
    </span>
  );
}

function SourceLink({
  source,
  showDomain = true,
}: {
  source: EventSource;
  showDomain?: boolean;
}) {
  return (
    <a
      className="ch-source"
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <em>{source.title}</em>
      {showDomain && (
        <span className="ch-src-domain"> · {domainOf(source.url)}</span>
      )}
    </a>
  );
}

function ReactionCard({ reaction }: { reaction: EventReaction }) {
  const platform = PLATFORM_LABEL[reaction.platform] ?? "";
  return (
    <a
      className="ch-reaction"
      href={reaction.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <p className="ch-reaction-quote">{reaction.quote}</p>
      <p className="ch-reaction-meta">
        <span className="ch-reaction-author">{reaction.author}</span>
        {platform && <span>{platform}</span>}
        <span className="ch-reaction-arrow" aria-hidden="true">
          ↗
        </span>
      </p>
    </a>
  );
}

function Reactions({ reactions }: { reactions: EventReaction[] }) {
  return (
    <div className="ch-reactions">
      {reactions.map((r) => (
        <ReactionCard key={r.url + r.author} reaction={r} />
      ))}
    </div>
  );
}

function Expand({
  open,
  id,
  children,
}: {
  open: boolean;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ch-expand" data-open={open} id={id}>
      <div className="ch-expand-inner" inert={!open}>
        {children}
      </div>
    </div>
  );
}

function MetaLine({ event }: { event: TimelineEvent }) {
  return (
    <p className="ch-entry-meta ch-meta">
      <time dateTime={event.date}>
        {formatEventDate(event.date, event.date_precision)}
      </time>
      <Tag cat={event.category} />
      {event.secondary_category && (
        <Tag cat={event.secondary_category} secondary />
      )}
    </p>
  );
}

export interface EntryProps {
  event: TimelineEvent;
  expanded: boolean;
  onToggle: (slug: string) => void;
}

export function EventEntry({ event, expanded, onToggle }: EntryProps) {
  const imp = Math.min(5, Math.max(1, event.importance));
  const reactions = event.reactions ?? [];
  const panelId = `x-${event.slug}`;

  /* ------------------------------- landmark ------------------------------- */
  if (imp >= 5) {
    return (
      <article
        className="ch-entry ch-entry--5"
        data-cat={event.category}
        id={`e-${event.slug}`}
      >
        <span className="ch-dot" aria-hidden="true" />
        <MetaLine event={event} />
        <h3 className="ch-entry-title">{event.title}</h3>
        <p className="ch-entry-summary">{event.summary}</p>
        <p className="ch-entry-foot">
          {event.sources.map((s) => (
            <SourceLink key={s.url} source={s} />
          ))}
        </p>
        {reactions.length > 0 && <Reactions reactions={reactions} />}
      </article>
    );
  }

  /* ------------------------------- footnote ------------------------------- */
  if (imp <= 2) {
    return (
      <article
        className="ch-entry ch-entry--2"
        data-cat={event.category}
        id={`e-${event.slug}`}
      >
        <span className="ch-dot" aria-hidden="true" />
        <button
          type="button"
          className="ch-entry-line"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => onToggle(event.slug)}
        >
          <time dateTime={event.date}>
            {formatEventDate(event.date, event.date_precision)}
          </time>
          <span className="ch-entry-title">{event.title}</span>
          <span className="ch-caret" aria-hidden="true">
            ▼
          </span>
        </button>
        <Expand open={expanded} id={panelId}>
          <p className="ch-entry-summary">{event.summary}</p>
          <p className="ch-entry-foot">
            {event.sources.map((s) => (
              <SourceLink key={s.url} source={s} />
            ))}
          </p>
          {reactions.length > 0 && <Reactions reactions={reactions} />}
        </Expand>
      </article>
    );
  }

  /* --------------------------- major and notable --------------------------- */
  const extraSources = imp === 3 ? event.sources.slice(1) : [];
  const visibleSources = imp === 3 ? event.sources.slice(0, 1) : event.sources;
  const hasMore = reactions.length > 0 || extraSources.length > 0;

  return (
    <article
      className={`ch-entry ch-entry--${imp}`}
      data-cat={event.category}
      id={`e-${event.slug}`}
    >
      <span className="ch-dot" aria-hidden="true" />
      <MetaLine event={event} />
      <h3 className="ch-entry-title">{event.title}</h3>
      <p className="ch-entry-summary">{event.summary}</p>
      <p className="ch-entry-foot">
        {visibleSources.map((s) => (
          <SourceLink key={s.url} source={s} />
        ))}
        {hasMore && (
          <button
            type="button"
            className="ch-rtoggle"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => onToggle(event.slug)}
          >
            {reactions.length > 0 ? (
              <span className="ch-rtoggle-count">
                {reactions.length}{" "}
                {reactions.length === 1 ? "reaction" : "reactions"}
              </span>
            ) : (
              <span>more sources</span>
            )}
            <span className="ch-caret" aria-hidden="true">
              ▼
            </span>
          </button>
        )}
      </p>
      {hasMore && (
        <Expand open={expanded} id={panelId}>
          {extraSources.length > 0 && (
            <p className="ch-entry-foot">
              {extraSources.map((s) => (
                <SourceLink key={s.url} source={s} />
              ))}
            </p>
          )}
          {reactions.length > 0 && <Reactions reactions={reactions} />}
        </Expand>
      )}
    </article>
  );
}
