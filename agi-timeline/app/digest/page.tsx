// "The Front Page" — AI history as a run of broadsheet issues.
// Server component: loads events, self-hosts fonts, hands off to the client app.

import type { Metadata } from "next";
import { Suspense } from "react";
import { Archivo, Fraunces, Newsreader } from "next/font/google";
import { getAllEvents } from "@/lib/events";
import FrontPageApp from "./FrontPageApp";
import "./digest.css";

// Dynamic rendering: filter state lives in query params and the full paper is
// server-rendered against them (useSearchParams would otherwise bail the whole
// page out to client-only rendering during static prerender).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Artificial Intelligencer — AGI Timeline",
  description:
    "Eighty-three years of machine intelligence, told as a run of newspaper front pages: 1943 to the present, issue by issue.",
};

const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--dg-font-display",
});

const body = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--dg-font-body",
});

const label = Archivo({
  subsets: ["latin"],
  variable: "--dg-font-label",
});

export default async function DigestPage() {
  const events = await getAllEvents();

  return (
    <div
      className={`dg-root -my-8 pb-24 ${display.variable} ${body.variable} ${label.variable}`}
    >
      <Suspense fallback={null}>
        <FrontPageApp events={events} />
      </Suspense>
    </div>
  );
}
