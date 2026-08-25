"use client";

/**
 * Minimap — the full 1943–2026 world range in one strip: a density
 * histogram of the currently filtered events, era boundaries, a draggable
 * viewport window, and a clickable era rail beneath it.
 */

import {
  useCallback,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { TimelineEvent } from "@/lib/types";
import { ERAS, dateToU, type Era, type View } from "./lib";

const BINS = 96;

interface Props {
  filtered: TimelineEvent[];
  view: View;
  onNavigate: (o: number) => void;
  onFitEra: (era: Era) => void;
}

export default function Minimap({ filtered, view, onNavigate, onFitEra }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const bars = useMemo(() => {
    const counts = new Array<number>(BINS).fill(0);
    for (const ev of filtered) {
      const b = Math.min(BINS - 1, Math.floor(dateToU(ev.date) * BINS));
      counts[b]++;
    }
    const max = Math.max(1, ...counts);
    return counts.map((c) => c / max);
  }, [filtered]);

  const navToClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const u = (clientX - r.left) / r.width;
      onNavigate(u - 0.5 / view.z);
    },
    [onNavigate, view.z],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      navToClientX(e.clientX);
    },
    [navToClientX],
  );
  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingRef.current) navToClientX(e.clientX);
    },
    [navToClientX],
  );
  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const span = 1 / view.z;
  const winLeft = Math.max(0, Math.min(1, view.o)) * 100;
  const winWidth = Math.max(0.4, Math.min(1 - view.o, span) * 100);

  return (
    <div className="tm-minimap">
      <div
        className="tm-mini-track"
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-hidden
      >
        <svg
          className="tm-mini-bars"
          preserveAspectRatio="none"
          viewBox={`0 0 ${BINS} 100`}
        >
          {bars.map((h, i) =>
            h > 0 ? (
              <rect
                key={i}
                x={i + 0.12}
                width={0.76}
                y={100 - h * 100}
                height={h * 100}
              />
            ) : null,
          )}
        </svg>
        {ERAS.slice(1).map((era) => (
          <span
            key={era.key}
            className="tm-mini-era-line"
            style={{ left: `${era.u0 * 100}%` }}
          />
        ))}
        <div
          className="tm-mini-win"
          style={{ left: `${winLeft}%`, width: `${winWidth}%` }}
        />
      </div>

      <div className="tm-era-rail" role="group" aria-label="Jump to an era">
        {ERAS.map((era) => (
          <button
            key={era.key}
            className="tm-era-btn"
            style={{ width: `${(era.u1 - era.u0) * 100}%` }}
            onClick={() => onFitEra(era)}
            title={`${era.name} (${era.short})`}
          >
            {era.name}
          </button>
        ))}
      </div>
    </div>
  );
}
