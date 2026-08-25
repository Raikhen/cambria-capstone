/**
 * OpenGraph link previews for the X-style link cards in reaction embeds.
 * GET /api/link-preview?url=… → { data: { url, site, title, description?,
 * image? } | null } — null whenever a usable title can't be extracted, which
 * the client renders as no card (the link stays visible in the tweet text).
 *
 * The target URL comes from tweet entities, i.e. arbitrary external input: only
 * http(s) is fetched and obviously-internal hosts are refused.
 */

import type { NextRequest } from "next/server";

interface Preview {
  url: string;
  site: string;
  title: string;
  description?: string;
  image?: string;
}

const PRIVATE_HOST =
  /^(localhost$|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i;

/* Tiny in-process cache so reopening the panel doesn't refetch pages. */
const cache = new Map<string, { exp: number; data: Preview | null }>();
const CACHE_TTL = 60 * 60 * 1000;
const CACHE_MAX = 500;

function metaContent(html: string, key: string): string | undefined {
  // Matches both attribute orders: <meta property="x" content="…"> and
  // <meta content="…" property="x">.
  const tag = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i"),
  )?.[0];
  const m = tag?.match(/content\s*=\s*["']([^"']*)["']/i);
  return m?.[1]?.trim() || undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

async function buildPreview(target: URL): Promise<Preview | null> {
  const res = await fetch(target, {
    signal: AbortSignal.timeout(6000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; agi-timeline-preview/1.0; +https://github.com)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) {
    return null;
  }
  const html = (await res.text()).slice(0, 400_000);

  const title =
    metaContent(html, "og:title") ??
    metaContent(html, "twitter:title") ??
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  if (!title) return null;

  const description =
    metaContent(html, "og:description") ?? metaContent(html, "twitter:description");
  const rawImage =
    metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
  let image: string | undefined;
  if (rawImage) {
    try {
      const u = new URL(decodeEntities(rawImage), res.url);
      if (u.protocol === "https:" || u.protocol === "http:") image = u.toString();
    } catch {
      /* unusable image URL — card renders without one */
    }
  }

  return {
    url: res.url,
    site: metaContent(html, "og:site_name") ?? new URL(res.url).hostname.replace(/^www\./, ""),
    title: decodeEntities(title),
    description: description ? decodeEntities(description) : undefined,
    image,
  };
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return Response.json({ error: "invalid url" }, { status: 400 });
  }
  if (
    (target.protocol !== "https:" && target.protocol !== "http:") ||
    PRIVATE_HOST.test(target.hostname) ||
    !target.hostname.includes(".")
  ) {
    return Response.json({ error: "unsupported url" }, { status: 400 });
  }

  const key = target.toString();
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) {
    return Response.json({ data: hit.data });
  }

  let data: Preview | null = null;
  try {
    data = await buildPreview(target);
  } catch {
    data = null;
  }

  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { exp: Date.now() + CACHE_TTL, data });

  return Response.json(
    { data },
    {
      headers: {
        "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000",
      },
    },
  );
}
