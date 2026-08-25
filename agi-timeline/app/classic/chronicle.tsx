"use client";

/**
 * The Chronicle — client shell.
 * Owns filter state (synced to ?cat=…&min=…), the expanded-entry set,
 * era grouping, and the scroll-spy that drives the era rail.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, TimelineEvent } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { ERAS, eraIdOf, type EraGroup } from "./lib";
import { EventEntry } from "./entry";
import { FilterBar } from "./filters";
import { EraRail } from "./rail";

const ALL_CATEGORIES: ReadonlySet<Category> = new Set(CATEGORIES);

function matches(
  event: TimelineEvent,
  cats: ReadonlySet<Category>,
  minImportance: number,
): boolean {
  if (event.importance < minImportance) return false;
  if (cats.size === CATEGORIES.length) return true;
  return (
    cats.has(event.category) ||
    (event.secondary_category !== null &&
      event.secondary_category !== undefined &&
      cats.has(event.secondary_category))
  );
}

export function Chronicle({ events }: { events: TimelineEvent[] }) {
  const [cats, setCats] = useState<ReadonlySet<Category>>(ALL_CATEGORIES);
  const [minImportance, setMinImportance] = useState(1);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [activeEra, setActiveEra] = useState(ERAS[0].id);
  const hydratedFromUrl = useRef(false);

  /* ------------------------- URL state (shareable) ------------------------- */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get("cat");
    if (catParam) {
      const parsed = catParam
        .split(",")
        .filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
      if (parsed.length > 0) setCats(new Set(parsed));
    }
    const minParam = Number(params.get("min"));
    if (Number.isInteger(minParam) && minParam >= 1 && minParam <= 5) {
      setMinImportance(minParam);
    }
    hydratedFromUrl.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedFromUrl.current) return;
    const params = new URLSearchParams(window.location.search);
    if (cats.size === CATEGORIES.length) params.delete("cat");
    else params.set("cat", CATEGORIES.filter((c) => cats.has(c)).join(","));
    if (minImportance <= 1) params.delete("min");
    else params.set("min", String(minImportance));
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [cats, minImportance]);

  /* ----------------------------- derived data ------------------------------ */

  const groups: EraGroup[] = useMemo(() => {
    const byEra = new Map<string, TimelineEvent[]>();
    const totals = new Map<string, number>();
    for (const era of ERAS) {
      byEra.set(era.id, []);
      totals.set(era.id, 0);
    }
    for (const event of events) {
      const id = eraIdOf(event.date);
      totals.set(id, (totals.get(id) ?? 0) + 1);
      if (matches(event, cats, minImportance)) byEra.get(id)?.push(event);
    }
    return ERAS.map((era) => ({
      era,
      events: byEra.get(era.id) ?? [],
      total: totals.get(era.id) ?? 0,
    }));
  }, [events, cats, minImportance]);

  const shown = useMemo(
    () => groups.reduce((n, g) => n + g.events.length, 0),
    [groups],
  );
  const countsByEra = useMemo(
    () => new Map(groups.map((g) => [g.era.id, g.events.length])),
    [groups],
  );
  const isDefault = cats.size === CATEGORIES.length && minImportance === 1;

  /* ------------------------------- scroll spy ------------------------------ */

  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = streamRef.current;
    if (!root) return;
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-era-section]"),
    );
    if (sections.length === 0) return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-era-section");
          if (!id) continue;
          if (entry.isIntersecting) visible.set(id, entry.boundingClientRect.top);
          else visible.delete(id);
        }
        if (visible.size > 0) {
          // The era whose section top is closest to (but above) the viewport
          // top third wins; falls back to the first visible one.
          let best: string | null = null;
          let bestTop = -Infinity;
          for (const [id, top] of visible) {
            if (top <= 200 && top > bestTop) {
              best = id;
              bestTop = top;
            }
          }
          setActiveEra(best ?? sections
            .map((s) => s.getAttribute("data-era-section"))
            .find((id) => id && visible.has(id)) ?? ERAS[0].id);
        }
      },
      { rootMargin: "-64px 0px -40% 0px", threshold: 0 },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [shown]);

  /* -------------------------------- handlers ------------------------------- */

  const toggleCategory = (cat: Category) => {
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleExpanded = (slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const reset = () => {
    setCats(ALL_CATEGORIES);
    setMinImportance(1);
  };

  /* --------------------------------- render -------------------------------- */

  return (
    <div className="chronicle-shell">
      <header className="ch-masthead">
        <p className="ch-masthead-overline ch-meta">
          A history in {events.length} events · 1943–2026
        </p>
        <h1 className="ch-masthead-title">
          The Chronicle of Artificial Intelligence
        </h1>
        <p className="ch-masthead-dek">
          From the first artificial neuron to the age of agents — the events
          that mattered, told in order.
        </p>
        <hr className="ch-masthead-rule" aria-hidden="true" />
      </header>

      <FilterBar
        selected={cats}
        minImportance={minImportance}
        shown={shown}
        total={events.length}
        activeEra={activeEra}
        isDefault={isDefault}
        onToggleCategory={toggleCategory}
        onMinImportance={setMinImportance}
        onReset={reset}
      />

      {shown === 0 ? (
        <div className="ch-empty">
          <p>
            Nothing in eighty-three years matches these filters. History is
            quieter than that.
          </p>
          <button type="button" className="ch-reset" onClick={reset}>
            Reset filters
          </button>
        </div>
      ) : (
        <div className="ch-layout">
          <div className="ch-stream" ref={streamRef}>
            {groups.map(({ era, events: eraEvents, total }) => (
              <section
                key={era.id}
                id={`era-${era.id}`}
                data-era-section={era.id}
                aria-labelledby={`era-${era.id}-title`}
              >
                <header className="ch-era-header">
                  <p className="ch-era-kicker ch-meta">
                    <span className="ch-era-numeral" aria-hidden="true">
                      {era.numeral}
                    </span>
                    <span>
                      Era {era.numeral} · {era.span}
                    </span>
                  </p>
                  <h2 className="ch-era-title" id={`era-${era.id}-title`}>
                    {era.title}
                  </h2>
                  <p className="ch-era-dek">{era.dek}</p>
                  <p className="ch-era-meta ch-meta">
                    {eraEvents.length === total
                      ? `${total} events`
                      : `${eraEvents.length} of ${total} events`}
                  </p>
                  <hr aria-hidden="true" />
                </header>

                {eraEvents.length === 0 ? (
                  <p className="ch-era-empty">
                    No events from this era match the current filters.
                  </p>
                ) : (
                  <div className="ch-era-body">
                    {eraEvents.map((event) => (
                      <EventEntry
                        key={event.slug}
                        event={event}
                        expanded={expanded.has(event.slug)}
                        onToggle={toggleExpanded}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}

            <footer className="ch-colophon">
              <p className="ch-meta">
                {events.length} events · curated, neutral,
                citation-grounded · 1943 – 2026
              </p>
            </footer>
          </div>

          <EraRail activeEra={activeEra} countsByEra={countsByEra} />
        </div>
      )}
    </div>
  );
}
