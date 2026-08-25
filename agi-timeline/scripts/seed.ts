/**
 * Seed script: validates data/seed/era-*.json and upserts events to Supabase.
 *
 * Usage (bun auto-loads .env.local):
 *   bun run scripts/seed.ts            # validate + upsert
 *   bun run scripts/seed.ts --dry-run  # validate only, no writes
 *
 * Idempotent: upserts on slug conflict, so re-running updates rather than
 * duplicating. Fails (exit 1) on validation errors or cross-file slug
 * collisions without writing anything.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { validateEvent } from "../lib/validate";
import type { TimelineEvent } from "../lib/types";

const DRY_RUN = process.argv.includes("--dry-run");
const SEED_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "seed",
);

async function main(): Promise<number> {
  let fileNames: string[] = [];
  try {
    fileNames = (await readdir(SEED_DIR))
      .filter((name) => /^era-.*\.json$/.test(name))
      .sort();
  } catch {
    console.error(`Seed directory not found: ${SEED_DIR}`);
    return 1;
  }
  if (fileNames.length === 0) {
    console.error(`No era-*.json files in ${SEED_DIR} — nothing to seed.`);
    return 1;
  }

  const slugToFile = new Map<string, string>();
  const valid: TimelineEvent[] = [];
  let totalErrors = 0;

  for (const name of fileNames) {
    const filePath = path.join(SEED_DIR, name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(filePath, "utf8"));
    } catch (err) {
      console.error(`✗ ${name}: unreadable or invalid JSON (${err})`);
      totalErrors++;
      continue;
    }

    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { events?: unknown[] })?.events)
        ? (parsed as { events: unknown[] }).events
        : [];
    if (list.length === 0) {
      console.error(`✗ ${name}: no events found (expected an array of events)`);
      totalErrors++;
      continue;
    }

    let fileErrors = 0;
    for (const [i, item] of list.entries()) {
      const errors = validateEvent(item);
      const slug = (item as TimelineEvent)?.slug ?? `<index ${i}>`;
      if (errors.length > 0) {
        console.error(`✗ ${name} → ${slug}:`);
        for (const e of errors) console.error(`    - ${e}`);
        fileErrors += errors.length;
        continue;
      }
      const event = item as TimelineEvent;
      const existing = slugToFile.get(event.slug);
      if (existing) {
        console.error(
          `✗ slug collision: "${event.slug}" appears in both ${existing} and ${name}`,
        );
        fileErrors++;
        continue;
      }
      slugToFile.set(event.slug, name);
      valid.push(event);
    }
    totalErrors += fileErrors;
    console.log(
      `${fileErrors === 0 ? "✓" : "✗"} ${name}: ${list.length} events, ${fileErrors} errors`,
    );
  }

  console.log(
    `\n${valid.length} valid events across ${fileNames.length} files, ${totalErrors} errors.`,
  );

  if (totalErrors > 0) {
    console.error("Validation failed — nothing written.");
    return 1;
  }
  if (DRY_RUN) {
    console.log("Dry run — no writes performed.");
    return 0;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (are you running via bun from the project root so .env.local loads?).",
    );
    return 1;
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const rows = valid.map((e) => ({
    slug: e.slug,
    date: e.date,
    date_precision: e.date_precision,
    title: e.title,
    summary: e.summary,
    category: e.category,
    secondary_category: e.secondary_category ?? null,
    importance: e.importance,
    importance_rationale: e.importance_rationale ?? null,
    sources: e.sources,
    reactions: e.reactions ?? [],
    added_by: e.added_by,
    updated_at: new Date().toISOString(),
  }));

  // Upsert in batches to stay well under payload limits.
  const BATCH = 100;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("events")
      .upsert(batch, { onConflict: "slug" });
    if (error) {
      console.error(`Upsert failed at batch ${i / BATCH + 1}: ${error.message}`);
      return 1;
    }
    written += batch.length;
  }

  console.log(`Upserted ${written} events to Supabase.`);
  return 0;
}

process.exit(await main());
