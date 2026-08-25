// "The Map" — a zoomable, pannable chart of AI history on a single axis.
// Server component: fetches all events and initial filter state from the URL,
// then hands off to the client-side instrument.

import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { getAllEvents } from "@/lib/events";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { CATEGORIES, type Category } from "@/lib/types";
import TheMap from "./map/TheMap";
import type { ScaleMode } from "./map/lib";
import "./map/map.css";

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
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [events, sp] = await Promise.all([getAllEvents(), searchParams]);

  // An absent `cats` param means "all"; a present one (even empty, i.e. all
  // categories cleared) is honored as-is.
  const rawCats = typeof sp.cats === "string" ? sp.cats : null;
  const initialCats: Category[] =
    rawCats === null
      ? [...CATEGORIES]
      : rawCats
          .split(",")
          .filter((c): c is Category =>
            (CATEGORIES as readonly string[]).includes(c),
          );

  const rawMin = typeof sp.min === "string" ? parseInt(sp.min, 10) : NaN;
  const initialMin =
    Number.isFinite(rawMin) && rawMin >= 1 && rawMin <= 5 ? rawMin : 1;

  const initialScale: ScaleMode = sp.scale === "linear" ? "linear" : "log";

  return (
    <div className={`${ui.variable} ${mono.variable}`}>
      <TheMap
        events={events}
        initialCats={initialCats}
        initialMin={initialMin}
        initialScale={initialScale}
      />
    </div>
  );
}
