# UI variant brief (shared by the three design agents)

Three agents are building three competing timeline UIs in parallel, one route each.
The user will compare them and pick a winner, so each variant must be **complete,
distinctive, and production-quality** — not a sketch.

## Hard boundaries (parallel-safety)

- Write ONLY inside your own route directory: `app/<your-route>/**` (page, layout,
  components, css modules — everything route-local). Creating files there is free.
- READ-ONLY, never modify: `lib/`, `app/layout.tsx`, `app/globals.css`,
  `app/api/`, `package.json`, any other route's directory, `docs/`, `data/`.
- **No new dependencies.** React 19 + Tailwind v4 + hand-rolled interaction only.
  `next/font/google` imports inside your own files are fine (self-hosted by Next).
- The root layout renders a small top nav above your page; design within that.

## Data

- Server component: `import { getAllEvents } from "@/lib/events"` (async, returns
  all events sorted by date). Pass to a client component for interactivity.
- Types in `lib/types.ts`; contract in `docs/EVENT_SCHEMA.md`. Read both.
- Dataset reality: **224 events, 1943 → Aug 2026, brutally uneven density** — 34
  events in the first 69 years, 190 in the last 14, ~90 in the last 20 months.
  A linear time axis is unusable; handle density deliberately (era-relative
  scaling, grouping, whatever fits your concept).
- Read `docs/INCLUSION_CRITERIA.md` to understand the content's voice and the six
  categories; the timeline is neutral-encyclopedic, commentary lives in reactions.

## Required features (all variants)

1. **Category filter** — toggle any subset of the six categories; an event matches
   if its primary OR secondary category is selected. Category must be legible at a
   glance (color/icon system of your choosing, consistent within your variant).
2. **Importance filter** — minimum-importance control (1–5). Default: show all.
3. **Importance hierarchy** — a 5 must feel like a landmark, a 2 like a footnote,
   at a glance, before reading a word.
4. **Event detail** — title, date (honor `date_precision`: year → "1956", month →
   "March 2023", day → full date), summary, sources as links (favor the first/
   primary), and `reactions` rendered as first-class quoted commentary — attributed,
   linked, visually quote-like (think elegant embedded-tweet, not a blockquote dump).
5. **Time navigation** — some way to jump/orient across eras (1943–2026).
6. **Count feedback** — visible "showing N of 224" so filtering is legible.
7. Filter state in URL query params (shareable) if it fits your architecture;
   otherwise client state is acceptable.

## Quality bar

- Invoke the `frontend-design` skill BEFORE writing any UI code, and follow it.
- After the build works, invoke the `polish` skill and act on it.
- Responsive down to 375px. Keyboard-navigable, visible focus, honest contrast.
- Dark/light: either support both via `prefers-color-scheme` or commit fully to one
  deliberate palette (no accidental half-themes).
- 224 events render smoothly: measure; virtualize/lazy-render only if needed.
- `bun run build` must pass with zero type errors. Verify your route responds via
  `bun dev --port <your assigned port>` + curl; do NOT use browser tools (the
  orchestrator does visual review afterward).

## Identity

You'll be given a distinct design concept. Commit to it hard — the point of three
variants is contrast. Do not converge on a generic "cards on a line" timeline.
