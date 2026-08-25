# Era 5 (2026) — research notes

Era: January 1, 2026 – August 25, 2026. 35 events in `era-5-2026.json`.
Method: full month-by-month sweep of Zvi Mowshowitz's Substack archive (fetched via
the archive API, ~130 posts in-era), then per-event verification against primary
sources (Anthropic/OpenAI/White House pages, Claude platform release notes) and news
coverage (TechCrunch, Axios, Forbes, SC Media, NBC, Fortune, The Hill, Wikipedia,
Tech Policy Press, CRS). Every event was verified by at least two independent
fetches/searches; nothing is from model memory (the whole era is past training cutoff).

## Candidates considered and rejected

1. **GPT-5.5 (Apr 28)** — routine point upgrade; Zvi: "like GPT-5.4, only more so"
   (Exclusions: routine releases).
2. **Claude Opus 4.7 (Apr 20)** — superseded by Opus 4.8 five weeks later; routine
   point upgrade.
3. **Claude Opus 4.8 (May 28)** — "incremental but real improvement" per Zvi; did not
   shift the frontier (routine release).
4. **Claude Sonnet 4.6 (Feb 17) and Sonnet 5 (Jun 30)** — mid-tier releases; routine.
5. **Gemini 3.1 Pro (Mar 4)** — benchmark gains without a demonstrated frontier shift;
   Zvi's title: "Aces Benchmarks, I Suppose" (routine release / benchmark without
   adoption).
6. **Gemini 3.5 Flash (May 22)** — speed-tier release; routine.
7. **GLM-5.2 (Jun 22)** — briefly "the new best open model" but superseded within a
   month by Kimi K3; Chinese open-weight story is carried by DeepSeek V4 + Kimi K3
   (duplicates rule / density guidance).
8. **Kimi K2.5 (Feb 4)** — incremental open-weight release; same rationale as above.
9. **Grok 4.5 (Jul 8)** — routine release; Grok 5 remained unreleased as of Aug 25,
   2026 and roadmap promises are excluded.
10. **Dwarkesh Patel's 2026 podcasts with Amodei (Feb) and Musk (Feb)** — commentary,
    not events (tweets/commentary are citations, not events).
11. **WSJ claim that China matched Anthropic (Jun 29)** — disputed reporting Zvi
    called "obvious nonsense"; drama without consequence.
12. **OpenAI "Built to Benefit Everyone" plan (early Jun)** — policy blueprint /
    roadmap promise; its coordination language is contextualized inside the
    pacing-the-frontier and NSPM-11 entries instead.
13. **NYT v. OpenAI discovery order on 20M ChatGPT logs (Jan)** — procedural step,
    no merits ruling as of Aug 2026; fails counterfactual-gap test as its own event.
14. **Claude's use in the Venezuela/Maduro operation (Axios, Feb 13)** — merged into
    the Anthropic–Pentagon standoff event as its proximate trigger (duplicates merge).
15. **"Citrini's Scenario" (Feb) and Hassabis's "New Coming Age" essay (Jul 19)** —
    predictions/hot takes without the discourse footprint of Amodei's essay or Plan A.
16. **Lightcone Commons launch (Jul 24)** — too niche; fails durability.
17. **ChatGPT self-portrait meme wave (Jan 20)** — vibes, no landmark moment.
18. **Anthropic reopening Pentagon negotiations (FT, Mar 4)** — follow-up news inside
    the dispute arc; merged.

## Low-confidence items and caveats

- **`fable-5-export-control-shutdown` date (Jun 12):** Claude platform docs, Wikipedia
  (Claude Mythos), and channel press say the Commerce directive landed Friday June 12;
  a summary of Zvi's post rendered it as "June 13, 5:21pm ET" (June 13 was a Saturday).
  I used June 12. Restoration July 1 is confirmed by Anthropic's platform release notes
  and anthropic.com/news/redeploying-fable-5.
- **`anthropic-rsp-v3` date (Feb 24):** the Anthropic page itself shows "Feb 24, 2026";
  Zvi's deep-dive ran April 1–3 (delayed by the DoW saga coverage). Low risk but noted
  because the coverage gap is unusual.
- **`moltbook-launch` (Jan 30):** coverage says "late January"; Zvi's timeline gives
  Jan 30 for launch, with NBC/Skift/CNBC pieces Jan 31–Feb 2. Day precision kept.
- **`pacing-the-frontier-letter` (Jul 29):** the letter site is undated; Jul 29 is the
  date of Zvi's same-week coverage and matches news timing. Signatories grew from
  ~1,224 at publication to 1,378 by late August (both figures verified).
- **`plan-a-scenario` and `openai-pac-false-flag`:** month precision — exact
  publication/admission days not pinned down (Zvi coverage Jul 11 and Jun 4
  respectively).
- **`astra-ten-open-problems` (Aug 1):** press said OpenAI "announced Saturday";
  Aug 1, 2026 was a Saturday; coverage ran Aug 3–4.
- **`black-hat-agent-message-board` (Aug 6):** dated to the SC Media/SiliconANGLE/IANS
  coverage of the Black Hat session (Aug 6); the talk may have been Aug 5.
- **OpenAI's joint HF statement URL** (openai.com/index/hugging-face-model-evaluation-security-incident/)
  returned 403 to my fetcher but is corroborated across multiple search results; kept
  as a source.
- **Reaction URLs:** where a quote's original X post URL could not be recovered, the
  reaction links to the Zvi post or article where the verbatim text appears (per the
  brief's rule to only quote text actually found). No tweet URLs were fabricated.
- **Notable reactions I could not recover verbatim** (mentioned in coverage but no
  quotable text found, so omitted): Hegseth's own "supply chain risk" tweet text
  (Mar 2); Karpathy's later "dumpster fire" Moltbook walk-back (paraphrased in Forbes
  India, exact wording unclear); Sam Altman's internal GPT-5.6 staff note (only
  fragments quoted in press).
- **Anthropic–DoD current status (as of Aug 25, 2026):** preliminary injunction stands
  (N.D. Cal., Mar 26); D.C. Circuit denied Anthropic's emergency motion (Apr 8/27
  reports differ on the exact denial date — both appear in sources); contract
  cancellation and Claude removal from DoD systems proceeded on a 180-day timeline;
  no settlement. The dispute remains unresolved; noted inside the injunction event.
- **No pure `research` events:** no 2026 paper cleared the inclusion bar within the
  era window; the Astra mathematics result carries `research` as secondary. Category
  balance: safety 10, capabilities 9, governance 7, culture 5, industry 4 (max 29%).
