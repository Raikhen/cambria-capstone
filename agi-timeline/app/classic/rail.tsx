"use client";

/**
 * Desktop era rail: sticky right-hand index of the five eras.
 * Highlights the era currently in view; each item jumps on click.
 */

import { ERAS } from "./lib";

export function EraRail({
  activeEra,
  countsByEra,
}: {
  activeEra: string;
  countsByEra: ReadonlyMap<string, number>;
}) {
  return (
    <aside className="ch-rail" aria-label="Timeline eras">
      <div className="ch-rail-inner">
        <ol>
          {ERAS.map((era) => (
            <li key={era.id} data-active={activeEra === era.id}>
              <a href={`#era-${era.id}`}>
                <span className="ch-rail-numeral">{era.numeral}</span>
                <span className="ch-rail-name">{era.title}</span>
                <span className="ch-rail-span">
                  {era.span} · {countsByEra.get(era.id) ?? 0}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
