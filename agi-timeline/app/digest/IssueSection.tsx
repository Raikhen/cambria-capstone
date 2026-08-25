"use client";

/**
 * One issue of the paper: masthead, banner stories (importance 5), front-page
 * majors (4), column items (3), and the "In other news" briefs band (≤2).
 * Importance is legible as page placement before a word is read.
 */

import type { CSSProperties } from "react";
import type { TimelineEvent } from "@/lib/types";
import {
  CATEGORY_META,
  formatEventDate,
  formatEventDateShort,
  type IssueDef,
} from "./issues";

interface Props {
  def: IssueDef;
  events: TimelineEvent[];
  onOpen: (event: TimelineEvent) => void;
}

function sectionVar(event: TimelineEvent): CSSProperties {
  return {
    "--sec": `var(${CATEGORY_META[event.category].cssVar})`,
  } as CSSProperties;
}

function Kicker({ event }: { event: TimelineEvent }) {
  return (
    <span className="dg-kicker" style={sectionVar(event)}>
      {CATEGORY_META[event.category].label}
      {event.secondary_category && (
        <span className="opacity-75">
          {" · "}
          {CATEGORY_META[event.secondary_category].label}
        </span>
      )}
    </span>
  );
}

/* --------------------------------------------------- banner (importance 5) */

function BannerStory({
  event,
  onOpen,
}: {
  event: TimelineEvent;
  onOpen: (e: TimelineEvent) => void;
}) {
  const reaction = event.reactions?.[0];
  return (
    <article className="dg-story py-5" style={sectionVar(event)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Kicker event={event} />
        <span className="dg-dateline">{formatEventDate(event)}</span>
      </div>
      <h3 className="dg-hed dg-hed-banner mt-2">
        <button
          type="button"
          className="dg-story-btn"
          onClick={() => onOpen(event)}
        >
          {event.title}
        </button>
      </h3>
      <div
        className={`mt-4 gap-8 ${reaction ? "grid lg:grid-cols-[1fr_17rem]" : ""}`}
      >
        <p className="dg-body dg-dropcap dg-lead-cols text-[1.02rem]">
          {event.summary}
        </p>
        {reaction && (
          <aside className="dg-pull relative z-10 mt-5 lg:mt-1">
            <p className="dg-pull-quote dg-clamp-6">{reaction.quote}</p>
            <p className="dg-dateline mt-2.5 normal-case tracking-normal">
              <a
                className="dg-link font-semibold"
                href={reaction.url}
                target="_blank"
                rel="noreferrer"
              >
                {reaction.author}
              </a>
            </p>
          </aside>
        )}
      </div>
    </article>
  );
}

/* ----------------------------------------------------- major (importance 4) */

function MajorStory({
  event,
  onOpen,
}: {
  event: TimelineEvent;
  onOpen: (e: TimelineEvent) => void;
}) {
  return (
    <article className="dg-story py-4" style={sectionVar(event)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Kicker event={event} />
        <span className="dg-dateline">{formatEventDateShort(event)}</span>
      </div>
      <h3 className="dg-hed dg-hed-major mt-1.5">
        <button
          type="button"
          className="dg-story-btn"
          onClick={() => onOpen(event)}
        >
          {event.title}
        </button>
      </h3>
      <p className="dg-body dg-clamp-3 mt-2">{event.summary}</p>
    </article>
  );
}

/* ---------------------------------------------------- column (importance 3) */

function ColumnItem({
  event,
  onOpen,
}: {
  event: TimelineEvent;
  onOpen: (e: TimelineEvent) => void;
}) {
  return (
    <article className="dg-story dg-col-item" style={sectionVar(event)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <Kicker event={event} />
        <span className="dg-dateline">{formatEventDateShort(event)}</span>
      </div>
      <h3 className="dg-hed dg-hed-col mt-1">
        <button
          type="button"
          className="dg-story-btn"
          onClick={() => onOpen(event)}
        >
          {event.title}
        </button>
      </h3>
      <p className="dg-body dg-clamp-3 mt-1 text-[0.88rem]">{event.summary}</p>
    </article>
  );
}

/* -------------------------------------------------------------- the issue */

export default function IssueSection({ def, events, onOpen }: Props) {
  const banners = events.filter((e) => e.importance >= 5);
  const majors = events.filter((e) => e.importance === 4);
  const columnItems = events.filter((e) => e.importance === 3);
  const briefs = events.filter((e) => e.importance <= 2);

  return (
    <section
      id={`issue-${def.slug}`}
      data-issue-slug={def.slug}
      className="dg-issue pt-12"
      aria-label={`Issue No. ${def.no}: ${def.title}, ${def.range}`}
    >
      <div className="dg-rule-double" />
      <div className="dg-folio mt-1.5">
        <span>No. {def.no}</span>
        <span>{def.range}</span>
        <span>
          {events.length} {events.length === 1 ? "dispatch" : "dispatches"}
        </span>
      </div>
      <h2 className="dg-issue-title mt-3 mb-4">{def.title}</h2>
      <div className="dg-rule-thick" />
      <div className="dg-rule mt-[3px]" />

      {banners.map((event) => (
        <div key={event.slug}>
          <BannerStory event={event} onOpen={onOpen} />
          <div className="dg-rule" />
        </div>
      ))}

      {majors.length > 0 && (
        <>
          <div className="dg-majors grid gap-x-10 md:grid-cols-2">
            {majors.map((event) => (
              <MajorStory key={event.slug} event={event} onOpen={onOpen} />
            ))}
          </div>
          <div className="dg-rule" />
        </>
      )}

      {columnItems.length > 0 && (
        <div className="dg-cols mt-4 mb-2">
          {columnItems.map((event) => (
            <ColumnItem key={event.slug} event={event} onOpen={onOpen} />
          ))}
        </div>
      )}

      {briefs.length > 0 && (
        <div className="dg-briefs mt-6 px-4 py-3 sm:px-5">
          <p className="leading-[1.9]">
            <span className="dg-eyebrow mr-4">In other news</span>
            {briefs.map((event, i) => (
              <span key={event.slug}>
                {i > 0 && (
                  <span className="dg-brief-sep" aria-hidden>
                    ◆
                  </span>
                )}
                <button
                  type="button"
                  className="dg-brief"
                  onClick={() => onOpen(event)}
                >
                  <span className="dg-brief-hed">{event.title}</span>{" "}
                  <span className="dg-dateline">
                    ({formatEventDateShort(event)})
                  </span>
                </button>
              </span>
            ))}
          </p>
        </div>
      )}
    </section>
  );
}
