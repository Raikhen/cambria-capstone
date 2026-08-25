// One-shot health check for the X API credentials used by tweet hydration.
// Usage: bun run scripts/test-x-api.ts [tweet_id]
// Bun auto-loads .env.local. Passes when it prints the tweet text + author.

export {};

const TWEET_ID = process.argv[2] ?? "2026731645169185220"; // Karpathy, Feb 2026

const token = process.env.X_BEARER_TOKEN;
if (!token) {
  console.error("X_BEARER_TOKEN is not set in .env.local");
  process.exit(1);
}

const params = new URLSearchParams({
  // note_tweet is required to get the full text of posts longer than 280 chars
  "tweet.fields": "created_at,text,note_tweet,public_metrics",
  expansions: "author_id",
  "user.fields": "username,name",
});

const res = await fetch(`https://api.x.com/2/tweets/${TWEET_ID}?${params}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const body = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`FAIL — HTTP ${res.status}`);
  console.error(JSON.stringify(body, null, 2));
  if (body?.reason === "client-not-enrolled") {
    console.error(
      "\nThe app is not attached to a Project. Fix in https://developer.x.com/en/portal:" +
        "\n  1. Create a Project and attach the App (or recreate the app inside it)" +
        "\n  2. Enable pay-per-use billing for read access" +
        "\n  3. Regenerate the bearer token and update X_BEARER_TOKEN in .env.local",
    );
  }
  process.exit(1);
}

const tweet = body.data;
const author = body.includes?.users?.[0];
const fullText: string = tweet.note_tweet?.text ?? tweet.text;

console.log("OK — X API read access works\n");
console.log(`Author:  ${author?.name} (@${author?.username})`);
console.log(`Date:    ${tweet.created_at}`);
console.log(`Metrics: ${JSON.stringify(tweet.public_metrics)}`);
console.log(`Long-form (note_tweet): ${tweet.note_tweet ? "yes" : "no"}`);
console.log(`\n--- text ---\n${fullText}`);
