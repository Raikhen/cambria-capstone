"use client";

/**
 * Client shell for The Artificial Intelligencer: masthead, edition controls
 * (category + minimum-importance filters, URL-backed), the archive rack with
 * scroll-spy, the run of issues, and the clipping detail panel.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Category, TimelineEvent } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { CATEGORY_META, ISSUES, groupIntoIssues } from "./issues";
import IssueSection from "./IssueSection";
import Clipping from "./Clipping";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const IMPORTANCE_HINT: Record<number, string> = {
  1: "Every dispatch",
  2: "Importance 2 and up",
  3: "Importance 3 and up — column items",
  4: "Importance 4 and up — front-page stories",
  5: "Importance 5 only — the landmarks",
};

export default function FrontPageApp({ events }: { events: TimelineEvent[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /* ------------------------------------------------ filter state (in URL) */

  const secParam = searchParams.get("sec");
  const selected = useMemo<ReadonlySet<Category>>(() => {
    if (secParam === null) return new Set(CATEGORIES);
    if (secParam === "none") return new Set();
    const picked = secParam
      .split(",")
      .filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
    return new Set(picked.length > 0 ? picked : CATEGORIES);
  }, [secParam]);

  const minImportance = useMemo(() => {
    const raw = Number(searchParams.get("min"));
    return Number.isInteger(raw) && raw >= 1 && raw <= 5 ? raw : 1;
  }, [searchParams]);

  const writeParams = useCallback(
    (nextSelected: ReadonlySet<Category>, nextMin: number) => {
      const params = new URLSearchParams();
      if (nextSelected.size < CATEGORIES.length) {
        params.set(
          "sec",
          nextSelected.size === 0
            ? "none"
            : CATEGORIES.filter((c) => nextSelected.has(c)).join(","),
        );
      }
      if (nextMin > 1) params.set("min", String(nextMin));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const toggleCategory = (cat: Category) => {
    const next = new Set(selected);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    writeParams(next, minImportance);
  };

  const resetEdition = () => writeParams(new Set(CATEGORIES), 1);
  const isFiltered = selected.size < CATEGORIES.length || minImportance > 1;

  /* --------------------------------------------------------- filtering */

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (e.importance < minImportance) return false;
        return (
          selected.has(e.category) ||
          (e.secondary_category !== null &&
            e.secondary_category !== undefined &&
            selected.has(e.secondary_category))
        );
      }),
    [events, selected, minImportance],
  );

  const issues = useMemo(() => groupIntoIssues(filtered), [filtered]);
  const liveIssues = issues.filter((i) => i.events.length > 0);

  /* ------------------------------------------------- clipping (detail) */

  const [openEvent, setOpenEvent] = useState<TimelineEvent | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const openClipping = useCallback((event: TimelineEvent) => {
    lastTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setOpenEvent(event);
  }, []);

  const closeClipping = useCallback(() => {
    setOpenEvent(null);
    lastTrigger.current?.focus();
  }, []);

  /* --------------------------------------------------------- scroll-spy */

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const rackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-issue-slug]"),
    );
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.getAttribute("data-issue-slug"));
          }
        }
      },
      { rootMargin: "-12% 0px -78% 0px" },
    );
    for (const s of sections) observer.observe(s);
    return () => observer.disconnect();
  }, [liveIssues.length]);

  // keep the active spine visible inside the rack (never scrolls the page)
  useEffect(() => {
    if (!activeSlug || !rackRef.current) return;
    const rack = rackRef.current;
    const item = rack.querySelector<HTMLElement>(
      `[data-rack-slug="${activeSlug}"]`,
    );
    if (!item) return;
    const target =
      item.offsetLeft - rack.clientWidth / 2 + item.clientWidth / 2;
    rack.scrollTo({ left: target, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [activeSlug]);

  const jumpTo = (slug: string) => {
    document.getElementById(`issue-${slug}`)?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  /* ------------------------------------------------------------ render */

  return (
    <>
      {/* ------------------------------------------------------ masthead */}
      <header className="dg-container pt-8 sm:pt-10">
        <p className="dg-eyebrow text-center">
          A chronicle of machine intelligence · 1943 – 2026
        </p>
        <h1 className="dg-masthead-title mt-3">The Artificial Intelligencer</h1>
        <div className="dg-rule-double mt-5" />
        <div className="dg-folio mt-1.5 pb-1.5">
          <span>Twenty issues</span>
          <span className="hidden sm:inline">
            Every dispatch sourced · commentary quoted verbatim
          </span>
          <span>{events.length} dispatches</span>
        </div>
        <div className="dg-rule" />
      </header>

      {/* ------------------------------------------------ edition controls */}
      <div className="dg-container flex flex-wrap items-center gap-x-5 gap-y-2 py-3">
        <span className="dg-eyebrow" id="dg-sections-label">
          Sections
        </span>
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
          role="group"
          aria-labelledby="dg-sections-label"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className="dg-chip"
              style={{ "--sec": `var(${CATEGORY_META[cat].cssVar})` } as React.CSSProperties}
              aria-pressed={selected.has(cat)}
              onClick={() => toggleCategory(cat)}
            >
              <span className="dg-dot" aria-hidden />
              {CATEGORY_META[cat].label}
            </button>
          ))}
        </div>
        <span className="dg-eyebrow ml-auto" id="dg-min-label">
          Min. importance
        </span>
        <div className="dg-seg" role="group" aria-labelledby="dg-min-label">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={minImportance === n}
              title={IMPORTANCE_HINT[n]}
              onClick={() => writeParams(selected, n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="dg-container">
        <div className="dg-rule" />
      </div>
      <div className="dg-container dg-folio py-1.5" aria-live="polite">
        <span>
          Showing {filtered.length} of {events.length} dispatches ·{" "}
          {liveIssues.length} of {ISSUES.length} issues
        </span>
        {isFiltered && (
          <button
            type="button"
            onClick={resetEdition}
            className="cursor-pointer font-semibold tracking-[0.15em] uppercase underline underline-offset-4 hover:text-[var(--signal)]"
          >
            Reset edition
          </button>
        )}
      </div>

      {/* --------------------------------------------------- archive rack */}
      <nav
        className="dg-rack"
        aria-label="Issue archive"
        hidden={liveIssues.length === 0}
      >
        <div className="dg-container dg-rack-scroll" ref={rackRef}>
          {issues.map(({ def, events: issueEvents }) =>
            issueEvents.length === 0 ? null : (
              <button
                key={def.slug}
                type="button"
                className="dg-rack-item"
                data-rack-slug={def.slug}
                data-active={activeSlug === def.slug}
                title={`${def.title} — ${issueEvents.length} dispatches`}
                onClick={() => jumpTo(def.slug)}
              >
                <span className="dg-rack-no">No. {def.no}</span>
                <span className="dg-rack-range">{def.range}</span>
              </button>
            ),
          )}
        </div>
      </nav>

      {/* ------------------------------------------------------- the run */}
      {liveIssues.length === 0 ? (
        <div className="dg-container py-24 text-center [&>*]:mx-auto [&_p]:max-w-md">
          <p className="dg-hed dg-hed-major">Nothing fit to print</p>
          <p className="dg-body mt-3">
            No dispatch matches this edition. Switch more sections back on, or
            lower the minimum importance.
          </p>
          <button type="button" onClick={resetEdition} className="dg-close mt-6">
            Reset the edition
          </button>
        </div>
      ) : (
        <div className="dg-container">
          {liveIssues.map(({ def, events: issueEvents }) => (
            <IssueSection
              key={def.slug}
              def={def}
              events={issueEvents}
              onOpen={openClipping}
            />
          ))}
        </div>
      )}

      {/* colophon */}
      <footer className="dg-container mt-16">
        <div className="dg-rule-thick" />
        <p className="dg-folio justify-center py-3">
          <span>
            The Artificial Intelligencer · printed continuously since 1943 ·
            all placement decisions final
          </span>
        </p>
      </footer>

      {openEvent && <Clipping event={openEvent} onClose={closeClipping} />}
    </>
  );
}
