"use client";

/**
 * Minimap — the full 1943–2026 world range in one strip: a density
 * histogram of the currently filtered events, a draggable viewport window,
 * and a sparse year scale beneath it. No named regions — just time.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { TimelineEvent } from "@/lib/types";
import { dateToU, minimapScale, type ScaleMode, type View } from "./lib";

const BINS = 96;

interface Props {
  filtered: TimelineEvent[];
  view: View;
  mode: ScaleMode;
  onNavigate: (o: number) => void;
}

export default function Minimap({ filtered, view, mode, onNavigate }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setTrackW(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bars = useMemo(() => {
    const counts = new Array<number>(BINS).fill(0);
    for (const ev of filtered) {
      const b = Math.min(BINS - 1, Math.floor(dateToU(ev.date, mode) * BINS));
      counts[b]++;
    }
    const max = Math.max(1, ...counts);
    return counts.map((c) => c / max);
  }, [filtered, mode]);

  // Keep year labels at least 44px apart at the current track width.
  const scale = useMemo(() => {
    const all = minimapScale(mode);
    if (trackW <= 0) return all;
    const out: typeof all = [];
    for (const t of all) {
      const prev = out[out.length - 1];
      if (prev && (t.u - prev.u) * trackW < 44) continue;
      out.push(t);
    }
    return out;
  }, [trackW, mode]);

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
        <div
          className="tm-mini-win"
          style={{ left: `${winLeft}%`, width: `${winWidth}%` }}
        />
      </div>

      <div className="tm-mini-scale" aria-hidden>
        {scale.map((t) => (
          <span
            key={t.label}
            style={{
              left: `${t.u * 100}%`,
              transform:
                t.u < 0.03
                  ? "none"
                  : t.u > 0.96
                    ? "translateX(-100%)"
                    : undefined,
            }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
