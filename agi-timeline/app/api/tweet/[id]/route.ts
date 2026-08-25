/**
 * Tweet data for reaction embeds, via Twitter's syndication API
 * (react-tweet's data layer). Shape matches what `useTweet` expects:
 * `{ data: Tweet | null }` — null when the post is gone/protected,
 * which the panel renders as a plain quote card.
 *
 * The syndication API has two gaps that fxtwitter fills (best-effort,
 * in parallel):
 * - long "note" tweets are truncated to ~280 chars with only an opaque
 *   `note_tweet.id` marker → full text attached as `note_text`;
 * - link cards aren't included at all → X's own card (title, description,
 *   domain, and its cached preview image) attached as `card`. This is the
 *   exact card X renders, so it works even for sites that block scrapers.
 */

import { getTweet, type Tweet } from "react-tweet/api";

interface TweetCard {
  url: string;
  site: string;
  title: string;
  description?: string;
  image?: string;
}

interface FxData {
  text?: string;
  card?: TweetCard;
}

type TweetPayload =
  | (Tweet & { note_text?: string; card?: TweetCard })
  | null;

/* Tiny in-process cache so reopening a panel doesn't refetch tweets. */
const cache = new Map<string, { exp: number; data: TweetPayload }>();
const CACHE_TTL = 60 * 60 * 1000;
const CACHE_MAX = 1000;

async function fetchFxData(id: string): Promise<FxData | undefined> {
  try {
    const res = await fetch(`https://api.fxtwitter.com/status/${id}`, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "agi-timeline/1.0" },
    });
    if (!res.ok) return undefined;
    const json = await res.json();
    const t = json?.tweet;
    if (!t) return undefined;

    let card: TweetCard | undefined;
    if (t.card?.url && t.card?.title) {
      card = {
        url: t.card.url,
        site: t.card.domain ?? new URL(t.card.url).hostname.replace(/^www\./, ""),
        title: t.card.title,
        description: t.card.description || undefined,
        image: t.card.image?.url || undefined,
      };
    }
    return {
      text: typeof t.text === "string" && t.text.length > 0 ? t.text : undefined,
      card,
    };
  } catch {
    return undefined;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d{1,25}$/.test(id)) {
    return Response.json({ error: "invalid tweet id" }, { status: 400 });
  }

  const hit = cache.get(id);
  if (hit && hit.exp > Date.now()) {
    return Response.json({ data: hit.data });
  }

  try {
    const [tweet, fx] = await Promise.all([getTweet(id), fetchFxData(id)]);

    let note_text: string | undefined;
    if (tweet?.note_tweet && fx?.text && fx.text.length > tweet.text.length) {
      note_text = fx.text;
    }
    const data: TweetPayload = tweet
      ? { ...tweet, note_text, card: fx?.card }
      : null;

    if (cache.size >= CACHE_MAX) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    cache.set(id, { exp: Date.now() + CACHE_TTL, data });

    return Response.json(
      { data },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch {
    return Response.json({ error: "failed to fetch tweet" }, { status: 502 });
  }
}
