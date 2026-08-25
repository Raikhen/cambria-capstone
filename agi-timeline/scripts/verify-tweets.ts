// One-off audit: verify every seed reaction that cites an x.com/twitter.com
// status URL against the canonical tweet via the X API. Reports quote
// mismatches, wrong authors, and dead tweets. Read-only — writes a JSON report.
// Usage: bun run scripts/verify-tweets.ts [reportPath]

import { readdir } from "node:fs/promises";
import path from "node:path";

const token = process.env.X_BEARER_TOKEN;
if (!token) {
  console.error("X_BEARER_TOKEN not set");
  process.exit(1);
}

const SEED_DIR = path.join(process.cwd(), "data", "seed");
const reportPath = process.argv[2] ?? "tweet-audit.json";

type Ref = {
  file: string;
  slug: string;
  idx: number;
  url: string;
  quote: string;
  author: string;
  id: string;
};

const refs: Ref[] = [];
for (const f of (await readdir(SEED_DIR)).filter((f) => f.endsWith(".json"))) {
  const events = JSON.parse(await Bun.file(path.join(SEED_DIR, f)).text());
  for (const ev of events) {
    (ev.reactions ?? []).forEach((r: any, idx: number) => {
      const m = r.url?.match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/);
      if (m)
        refs.push({
          file: f,
          slug: ev.slug,
          idx,
          url: r.url,
          quote: r.quote,
          author: r.author,
          id: m[1],
        });
    });
  }
}
console.log(`${refs.length} tweet-linked reactions found`);

// batch fetch, 100 ids per call
const byId = new Map<string, any>();
const errorsById = new Map<string, string>();
const ids = [...new Set(refs.map((r) => r.id))];
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const params = new URLSearchParams({
    ids: chunk.join(","),
    "tweet.fields": "text,note_tweet,created_at",
    expansions: "author_id",
    "user.fields": "name,username",
  });
  const res = await fetch(`https://api.x.com/2/tweets?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`batch ${i / 100} failed: HTTP ${res.status}`);
    continue;
  }
  const body = await res.json();
  const users = new Map(
    (body.includes?.users ?? []).map((u: any) => [u.id, u]),
  );
  for (const t of body.data ?? [])
    byId.set(t.id, { ...t, user: users.get(t.author_id) });
  for (const e of body.errors ?? [])
    errorsById.set(e.resource_id ?? e.value, e.title ?? "error");
  console.log(`batch ${i / 100 + 1}: ${body.data?.length ?? 0} found, ${body.errors?.length ?? 0} errors`);
}

const norm = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .replace(/^\.{3}|\.{3}$/g, "")
    .trim()
    .toLowerCase();

const report = { ok: [] as any[], mismatch: [] as any[], dead: [] as any[] };
for (const r of refs) {
  const t = byId.get(r.id);
  if (!t) {
    report.dead.push({ ...r, reason: errorsById.get(r.id) ?? "not returned" });
    continue;
  }
  const canonical = t.note_tweet?.text ?? t.text;
  const quoteOk = norm(canonical).includes(norm(r.quote));
  const handle = r.url.match(/(?:x|twitter)\.com\/([^/]+)\/status/)?.[1] ?? "";
  const handleOk =
    handle.toLowerCase() === (t.user?.username ?? "").toLowerCase();
  if (quoteOk && handleOk) report.ok.push({ slug: r.slug, id: r.id });
  else
    report.mismatch.push({
      ...r,
      quoteOk,
      handleOk,
      canonicalUser: t.user?.username,
      canonicalName: t.user?.name,
      canonical: canonical.slice(0, 500),
    });
}

await Bun.write(reportPath, JSON.stringify(report, null, 2));
console.log(
  `OK: ${report.ok.length} · mismatched: ${report.mismatch.length} · dead/inaccessible: ${report.dead.length}`,
);
console.log(`report → ${reportPath}`);
