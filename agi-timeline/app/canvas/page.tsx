// "The Map" — a zoomable, pannable chart of AI history on a single axis.
// Server component: fetches all events and initial filter state from the URL,
// then hands off to the client-side instrument.

import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { getAllEvents } from "@/lib/events";
import { CATEGORIES, type Category } from "@/lib/types";
import TheMap from "./TheMap";
import "./canvas.css";

const ui = Instrument_Sans({
  subsets: ["latin"],
  variable: "--tm-font-ui",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--tm-font-mono",
});

export const metadata: Metadata = {
  title: "The Map — AGI Timeline",
  description:
    "The whole of AI history as one navigable line: pan, zoom, and hear what people said as it happened, 1943 to today.",
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
    <div className={`${ui.variable} ${mono.variable}`}>
      <TheMap
        events={events}
        initialCats={initialCats}
        initialMin={initialMin}
      />
    </div>
  );
}
