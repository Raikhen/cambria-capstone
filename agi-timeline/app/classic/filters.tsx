"use client";

/**
 * Sticky filter bar: category toggles, minimum-importance control,
 * live count, reset, and (below lg) the mobile era strip.
 */

import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { CATEGORY_META, ERAS } from "./lib";

const IMPORTANCE_STOPS: { value: number; label: string; title: string }[] = [
  { value: 1, label: "All", title: "Every event" },
  { value: 2, label: "2+", title: "Context and above" },
  { value: 3, label: "3+", title: "Notable and above" },
  { value: 4, label: "4+", title: "Major and above" },
  { value: 5, label: "5", title: "Landmarks only" },
];

export interface FilterBarProps {
  selected: ReadonlySet<Category>;
  minImportance: number;
  shown: number;
  total: number;
  activeEra: string;
  isDefault: boolean;
  onToggleCategory: (cat: Category) => void;
  onMinImportance: (min: number) => void;
  onReset: () => void;
}

export function FilterBar({
  selected,
  minImportance,
  shown,
  total,
  activeEra,
  isDefault,
  onToggleCategory,
  onMinImportance,
  onReset,
}: FilterBarProps) {
  return (
    <div className="ch-filters">
      <div
        className="ch-cats"
        role="group"
        aria-label="Filter by category (an event matches if its primary or secondary category is on)"
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className="ch-cat"
            data-cat={cat}
            aria-pressed={selected.has(cat)}
            onClick={() => onToggleCategory(cat)}
          >
            <span className="ch-cat-dot" aria-hidden="true" />
            <span className="ch-cat-label">{CATEGORY_META[cat].label}</span>
          </button>
        ))}
      </div>

      <div className="ch-filters-right">
        <div
          className="ch-imp"
          role="group"
          aria-label="Minimum importance, 1 to 5"
        >
          {IMPORTANCE_STOPS.map((stop) => (
            <button
              key={stop.value}
              type="button"
              className="ch-imp-btn"
              title={stop.title}
              aria-pressed={minImportance === stop.value}
              onClick={() => onMinImportance(stop.value)}
            >
              {stop.label}
            </button>
          ))}
        </div>

        {!isDefault && (
          <button type="button" className="ch-reset" onClick={onReset}>
            Reset
          </button>
        )}

        <p className="ch-count" aria-live="polite">
          Showing <strong>{shown}</strong> of {total}
        </p>
      </div>

      <nav className="ch-erastrip" aria-label="Jump to era">
        {ERAS.map((era) => (
          <a
            key={era.id}
            href={`#era-${era.id}`}
            data-active={activeEra === era.id}
          >
            {era.numeral} · {era.span}
          </a>
        ))}
      </nav>
    </div>
  );
}
