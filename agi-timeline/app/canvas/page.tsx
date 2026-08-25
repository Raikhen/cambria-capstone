// "The Map" — a zoomable, pannable spatial chart of AI history.
// Server component: fetches all events and initial filter state from the URL,
// then hands off to the client-side instrument.

import type { Metadata } from "next";
import { Archivo, Instrument_Serif, Spline_Sans_Mono } from "next/font/google";
import { getAllEvents } from "@/lib/events";
import { CATEGORIES, type Category } from "@/lib/types";
import TheMap from "./TheMap";
import "./canvas.css";

const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--tm-font-display",
});
const ui = Archivo({
  subsets: ["latin"],
  variable: "--tm-font-ui",
});
const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--tm-font-mono",
});

export const metadata: Metadata = {
  title: "The Map — AGI Timeline",
  description:
    "The whole of AI history as one navigable landscape: pan, zoom, and chart a course from 1943 to today.",
};

export default async function CanvasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [events, sp] = await Promise.all([getAllEvents(), searchParams]);

  const rawCats = typeof sp.cats === "string" ? sp.cats : "";
  const parsedCats = rawCats
    .split(",")
    .filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
  const initialCats: Category[] =
    parsedCats.length > 0 ? parsedCats : [...CATEGORIES];

  const rawMin = typeof sp.min === "string" ? parseInt(sp.min, 10) : NaN;
  const initialMin =
    Number.isFinite(rawMin) && rawMin >= 1 && rawMin <= 5 ? rawMin : 1;

  return (
    <div className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <TheMap
        events={events}
        initialCats={initialCats}
        initialMin={initialMin}
      />
    </div>
  );
}
