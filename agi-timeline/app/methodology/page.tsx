// Renders docs/INCLUSION_CRITERIA.md — the editorial policy — as the public
// Methodology page, followed by the backfill researchers' working notes
// (candidates considered and rejected, with reasons, per era). The markdown is
// read at build time.

import { promises as fs } from "node:fs";
import path from "node:path";
import { marked } from "marked";

export const dynamic = "force-static";

const ERA_NOTES: { file: string; title: string }[] = [
  { file: "era-1-notes.md", title: "Era 1 — The Foundations (1943–2011)" },
  { file: "era-2-notes.md", title: "Era 2 — The Deep Learning Era (2012–2022)" },
  { file: "era-3-notes.md", title: "Era 3 — The ChatGPT Era (Nov 2022–2024)" },
  { file: "era-4-notes.md", title: "Era 4 — 2025" },
  { file: "era-5-notes.md", title: "Era 5 — 2026" },
];

export default async function MethodologyPage() {
  const mdPath = path.join(process.cwd(), "docs", "INCLUSION_CRITERIA.md");
  const markdown = await fs.readFile(mdPath, "utf8");
  const html = await marked.parse(markdown, { gfm: true });

  const notes = await Promise.all(
    ERA_NOTES.map(async ({ file, title }) => {
      try {
        const raw = await fs.readFile(
          path.join(process.cwd(), "data", "seed", file),
          "utf8",
        );
        return { title, html: await marked.parse(raw, { gfm: true }) };
      } catch {
        return null;
      }
    }),
  );

  return (
    <div className="max-w-3xl">
      <article
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <section className="mt-16 border-t pt-10">
        <h1 className="mb-2 text-2xl font-semibold">
          Appendix: what didn&apos;t make it, and why
        </h1>
        <p className="mb-8 text-sm opacity-70">
          The initial timeline was backfilled by five research agents, one per
          era, each applying the policy above. Their working notes — including
          every candidate they considered and rejected, with the rule it failed —
          are published here unedited, as part of the timeline&apos;s
          methodology.
        </p>
        {notes.map(
          (n) =>
            n && (
              <details key={n.title} className="group mb-4 rounded border">
                <summary className="cursor-pointer px-4 py-3 font-medium">
                  {n.title}
                </summary>
                <div
                  className="markdown-body border-t px-4 py-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: n.html }}
                />
              </details>
            ),
        )}
      </section>
    </div>
  );
}
