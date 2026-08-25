/**
 * /classic — "The Chronicle": a vertical editorial scroll timeline of the
 * road to advanced AI, 1943 → today. Server component: loads all events,
 * self-hosts the two typefaces, hands off to the client shell.
 */

import type { Metadata } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import { getAllEvents } from "@/lib/events";
import { Chronicle } from "./chronicle";
import "./chronicle.css";

const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-chronicle-serif",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-chronicle-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Chronicle · AGI Timeline",
  description:
    "An editorial chronicle of the events that mattered on the road to advanced AI, 1943 to today.",
};

export const revalidate = 300;

export default async function ClassicPage() {
  const events = await getAllEvents();

  return (
    <div className={`chronicle ${serif.variable} ${sans.variable}`}>
      <Chronicle events={events} />
    </div>
  );
}
