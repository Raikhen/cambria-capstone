"use client";

/**
 * Official embeds for reactions, kept minimal to match the panel's paper
 * aesthetic. An X status renders as a quiet full-width card built from the
 * syndication API data (react-tweet's data layer — no widget iframe, no
 * action bar, no follow button); a Substack note renders as Substack's note
 * iframe. The plain quote card shows while an embed loads and stays if the
 * post is unavailable. Long-form URLs (Substack posts, blogs, news) always
 * keep the quote card — their embeds are title cards that would drop the
 * quoted excerpt.
 *
 * Substack's embed.js only scans the document once at script load, which
 * doesn't survive a panel that mounts content later, so we build the same
 * iframe it would (see https://substack.com/embedjs/embed.js): notes map to
 * <host>/embed/c/<id>, and the frame posts `{ iframeHeight }` messages to
 * size itself.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { enrichTweet, useTweet, type EnrichedTweet } from "react-tweet";
import type { EventReaction } from "@/lib/types";
import { PLATFORM_LABEL } from "./lib";

export function tweetIdFrom(url: string): string | null {
  const m = url.match(
    /^https?:\/\/(?:[\w-]+\.)?(?:twitter|x)\.com\/.*?\/status(?:es)?\/(\d+)/i,
  );
  return m ? m[1] : null;
}

export function substackNoteEmbedFrom(url: string): string | null {
  const m = url.match(
    /^(https?:\/\/[^/]+)\/(?:@[^/]+|profile\/[^/]+)\/note\/c-(\d+)/i,
  );
  return m ? `${m[1]}/embed/c/${m[2]}` : null;
}

function QuoteCard({ r }: { r: EventReaction }) {
  return (
    <figure className="tm-quote">
      <blockquote className="tm-quote-text">{r.quote}</blockquote>
      <figcaption className="tm-quote-meta">
        <span className="tm-quote-author">{r.author}</span>
        <span>{PLATFORM_LABEL[r.platform] ?? ""}</span>
        <a href={r.url} target="_blank" rel="noopener noreferrer">
          source ↗
        </a>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ X */

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

/* Full note text arrives as plain text (from fxtwitter), so links/mentions/
   hashtags are re-linked by pattern instead of API entities. */
function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(https?:\/\/[^\s]+)|@(\w{1,15})|#(\w+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const href = m[1]
      ? m[1]
      : m[2]
        ? `https://x.com/${m[2]}`
        : `https://x.com/hashtag/${m[3]}`;
    const label = m[1] ? m[1].replace(/^https?:\/\/(www\.)?/, "") : m[0];
    parts.push(
      <a key={m.index} href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>,
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* Entity handling mirrors react-tweet's TweetBody: linked entities become
   anchors; plain text spans keep the API's HTML encoding. */
function TweetText({
  t,
  hideTrailingUrl,
  after,
}: {
  t: EnrichedTweet;
  hideTrailingUrl: boolean;
  after?: ReactNode;
}) {
  // X hides a trailing link from the text when it renders as a card below.
  const lastShown = [...t.entities]
    .reverse()
    .find((e) => e.type !== "media" && e.text.trim() !== "");
  const trailingUrl =
    hideTrailingUrl && lastShown?.type === "url" ? lastShown : null;

  return (
    <p className="tm-tweet-text" lang={t.lang} dir="auto">
      {t.in_reply_to_screen_name && (
        <a
          className="tm-tweet-replyto"
          href={t.in_reply_to_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Replying to @{t.in_reply_to_screen_name}
        </a>
      )}
      {t.entities.map((e, i) => {
        if (e === trailingUrl) return null;
        switch (e.type) {
          case "hashtag":
          case "mention":
          case "url":
          case "symbol":
            return (
              <a key={i} href={e.href} target="_blank" rel="noopener noreferrer">
                {e.text}
              </a>
            );
          case "media":
            return null;
          default:
            return <span key={i} dangerouslySetInnerHTML={{ __html: e.text }} />;
        }
      })}
      {after}
    </p>
  );
}

interface LinkPreview {
  url: string;
  site: string;
  title: string;
  description?: string;
  image?: string;
}

/* undefined = loading, null = no usable preview. */
function useLinkPreview(url: string | null): LinkPreview | null | undefined {
  const [data, setData] = useState<LinkPreview | null | undefined>(
    url ? undefined : null,
  );
  useEffect(() => {
    if (!url) {
      setData(null);
      return;
    }
    let cancelled = false;
    setData(undefined);
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : { data: null }))
      .then((json) => {
        if (!cancelled) setData(json.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return data;
}

function LinkCard({ p }: { p: LinkPreview }) {
  return (
    <a
      className="tm-tweet-lcard"
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {p.image && <img src={p.image} alt="" loading="lazy" />}
      <span className="tm-tweet-lcard-body">
        <span className="tm-tweet-lcard-site">{p.site}</span>
        <span className="tm-tweet-lcard-title">{p.title}</span>
        {p.description && (
          <span className="tm-tweet-lcard-desc">{p.description}</span>
        )}
      </span>
    </a>
  );
}

function TweetEmbed({ r, id }: { r: EventReaction; id: string }) {
  const { data, error } = useTweet(id, `/api/tweet/${id}`);

  const t = data ? enrichTweet(data) : null;
  // Server-side enrichments riding along on the syndication payload:
  // full text for long "note" tweets, and X's own link card.
  const extras = data as { note_text?: string; card?: LinkPreview } | null | undefined;
  const noteText = extras?.note_text;
  const serverCard = extras?.card;

  // X shows a link card only when the tweet has no native media; the last
  // link in the text is the one that gets the card. X's own card comes with
  // the tweet; the OpenGraph scrape is the fallback when it's missing.
  const hasMedia = !!(t?.photos?.length || t?.video);
  const lastUrlEntity = t
    ? [...t.entities].reverse().find((e) => e.type === "url")
    : undefined;
  const ogPreview = useLinkPreview(
    !serverCard && !hasMedia && lastUrlEntity ? lastUrlEntity.href : null,
  );
  const card = (!hasMedia ? serverCard : undefined) ?? ogPreview;

  // undefined = loading, null = deleted/protected — quote card either way,
  // permanently in the null/error case.
  if (!t || error) return <QuoteCard r={r} />;
  const date = new Date(t.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <figure className="tm-quote tm-tweet">
      <div className="tm-tweet-head">
        <a
          className="tm-tweet-avatar"
          href={t.user.url}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
        >
          <img src={t.user.profile_image_url_https} alt="" loading="lazy" />
        </a>
        <a
          className="tm-tweet-name"
          href={t.user.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.user.name}
        </a>
        <span className="tm-tweet-handle">@{t.user.screen_name}</span>
        <a
          className="tm-tweet-x"
          href={t.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View on X"
        >
          <XLogo />
        </a>
      </div>

      {noteText ? (
        // Long tweet with full text recovered — always shown whole. When a
        // card renders below, the trailing URL is dropped like X does.
        <p className="tm-tweet-text" lang={t.lang} dir="auto">
          {linkify(card ? noteText.replace(/\s*https?:\/\/\S+\s*$/, "") : noteText)}
        </p>
      ) : (
        <TweetText
          t={t}
          hideTrailingUrl={!!card}
          after={
            t.note_tweet ? (
              // Full text unavailable — fall back to the post on X.
              <a href={t.url} target="_blank" rel="noopener noreferrer">
                {" "}
                Show more
              </a>
            ) : undefined
          }
        />
      )}

      {t.photos && t.photos.length > 0 && (
        <div className={`tm-tweet-media${t.photos.length > 1 ? " multi" : ""}`}>
          {t.photos.map((p) => (
            <img key={p.url} src={p.url} alt="" loading="lazy" />
          ))}
        </div>
      )}
      {t.video && (
        <a
          className="tm-tweet-media tm-tweet-video"
          href={t.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Watch video on X"
        >
          <img src={t.video.poster} alt="" loading="lazy" />
          <span className="tm-tweet-play" aria-hidden>
            ▶
          </span>
        </a>
      )}

      {t.quoted_tweet && (
        <a
          className="tm-tweet-quoted"
          href={t.quoted_tweet.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <b>{t.quoted_tweet.user.name}</b> {t.quoted_tweet.text}
        </a>
      )}

      {card && <LinkCard p={card} />}

      <figcaption className="tm-quote-meta">
        <span>{date}</span>
        <a href={t.url} target="_blank" rel="noopener noreferrer">
          on X ↗
        </a>
      </figcaption>
    </figure>
  );
}

/* ----------------------------------------------------------- Substack */

function SubstackNoteEmbed({ r, embedUrl }: { r: EventReaction; embedUrl: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [height, setHeight] = useState(300);
  const [loaded, setLoaded] = useState(false);

  // Built client-side: the frame wants the embedding page's origin/URL.
  useEffect(() => {
    const u = new URL(embedUrl);
    u.searchParams.set("origin", window.location.origin);
    u.searchParams.set("fullURL", window.location.href);
    setSrc(u.toString());
  }, [embedUrl]);

  useEffect(() => {
    const origin = new URL(embedUrl).origin;
    const onMsg = (e: MessageEvent) => {
      if (
        e.origin === origin &&
        iframeRef.current &&
        e.source === iframeRef.current.contentWindow &&
        typeof e.data?.iframeHeight === "number"
      ) {
        setHeight(e.data.iframeHeight);
        setLoaded(true);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [embedUrl]);

  return (
    <div className="tm-embed">
      {!loaded && <QuoteCard r={r} />}
      {src && (
        <iframe
          ref={iframeRef}
          className="tm-embed-frame"
          src={src}
          title={`Substack note by ${r.author}`}
          height={height}
          scrolling="no"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-top-navigation allow-popups"
          style={!loaded ? { position: "absolute", visibility: "hidden" } : undefined}
        />
      )}
    </div>
  );
}

export default function Reaction({ r }: { r: EventReaction }) {
  const tweetId = r.platform === "x" ? tweetIdFrom(r.url) : null;
  if (tweetId) return <TweetEmbed r={r} id={tweetId} />;

  const noteUrl = r.platform === "substack" ? substackNoteEmbedFrom(r.url) : null;
  if (noteUrl) return <SubstackNoteEmbed r={r} embedUrl={noteUrl} />;

  return <QuoteCard r={r} />;
}
