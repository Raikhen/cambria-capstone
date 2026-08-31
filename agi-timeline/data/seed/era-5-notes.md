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

## Densify pass (2026-08-30)

Second pass under the revised editorial policy, where importance 1 ("Footnote — connective tissue") is a normal publishable tier. Added 12 events, all dated 2026-01-10 to 2026-08-14, taking the era file from 35 to 47 events. Method: month-by-month re-read of Zvi Mowshowitz's Substack archive index for 2026 (~170 posts), the Wikipedia "2026 in artificial intelligence" chronology, then per-candidate verification against primary sources (Anthropic, OpenAI, NVIDIA newsroom, White House, Florida AG, PIB India, Science/PubMed) and independent news coverage. Nothing here is from model memory; the entire era is past training cutoff.

Added: `grok-deepfake-national-bans` (3), `openclaw-personal-agent-framework` (2), `spacex-acquires-xai` (3), `gpt-4o-retirement-backlash` (2), `india-ai-impact-summit-new-delhi-declaration` (3), `openai-department-of-war-contract` (3), `nvidia-vera-rubin-platform` (2), `openai-shuts-down-sora` (2), `florida-sues-openai-altman` (2), `eu-ai-act-transparency-obligations-apply` (2), `ai-designed-bacteriophage-genomes` (3), `anthropic-claude-text-watermarking` (1).

### Candidates considered and rejected in this pass

1. **Grok 4.6 (Aug 12)** — routine point release; strong on benchmarks but did not move the frontier (routine releases).
2. **Gemini 3.7 Flash (mentioned Aug)** — speed-tier point release; routine.
3. **ChatGPT-5.3-Codex (Feb 13)** — coding-tier variant of an already-covered family; routine release.
4. **Claude Sonnet 5 (Jun 30)** — explicitly "not frontier" per Zvi; routine release.
5. **Anthropic Series G, ~$30B at ~$380B (Feb)** and **Series H (May)** — very large but still ordinary business; they did not change who can build frontier models (ordinary business).
6. **Peter Steinberger joining OpenAI and the OpenClaw Foundation (Feb 14)** — executive move without a shift in who can build frontier AI; folded into the OpenClaw event as context.
7. **China restricting state agencies and banks from using OpenClaw (Mar)** — real but thinly sourced follow-up; merged as context rather than a separate entry.
8. **Baltimore's suit against xAI over Grok imagery (Mar 24)** — a municipal follow-on to the deepfake story already carried by the national-bans event (duplicates merge).
9. **Ofcom's investigation into X (Jan)** — the regulatory response inside the Grok deepfake arc; merged into that event.
10. **METR/Redwood and OpenAI postmortems of the Hugging Face hack (Aug 28–29)** — follow-ups to `openai-hugging-face-incident`; merge there rather than becoming new entries.
11. **"The Three AI Pills" / "Against Modesty's Bailey" / "The Pacing of the Frontier" (Aug)** — commentary essays, not events.
12. **Polling showing Americans dislike data centers (Aug 24)** — a discourse trend without a landmark dated moment.
13. **NY RAISE Act chapter amendment (Mar 27)** — a technical amendment to a law signed in December 2025 that does not take effect until January 2027; fails the counterfactual-gap test on its own.
14. **India's Pax Silica accession and ~$250B summit investment pledges (Feb)** — folded into the summit event; the pledges alone are ordinary business.
15. **Sora API sunset (Sep 24)** — dated after the era window and in the future relative to today; only the announced date is referenced inside the shutdown event.

### Low-confidence items and caveats from this pass

- **`grok-deepfake-national-bans` (Jan 10):** Wikipedia's chronology gives Indonesia Jan 10 and Malaysia Jan 11; ABC News describes the blocks as falling on "Saturday" and "Sunday," which are Jan 10 and Jan 11 in 2026, but its own text renders them as Jan 11/12. I used Jan 10 for the first ban. Ofcom's investigation is dated Jan 12–13 in ABC/CMS coverage while Wikipedia lists a Feb 3 Ofcom action; the summary therefore avoids pinning an Ofcom date.
- **`openai-department-of-war-contract` (Feb 28):** Zvi's Mar 3 account says the deal was signed "Friday evening," i.e. Feb 27; press coverage reports Feb 28. I used Feb 28 (day precision) to match the reported signing date, and note the one-day ambiguity here. The March 2 amendment announcement is described inside the event rather than as a separate entry.
- **`openai-shuts-down-sora` (Mar 24):** TechCrunch and the OpenAI X post are dated Mar 24; The Decoder places the announcement on Mar 28. Shutdown dates (Apr 26 app, Sep 24 API) are consistent across all sources including OpenAI's help centre. Sora's daily-cost and lifetime-revenue figures come from secondary reporting, not OpenAI, and are attributed as such in the summary.
- **`openclaw-personal-agent-framework` (Jan 30):** dated to the final OpenClaw rename; the underlying release history (Warelay Nov 2025, Clawdbot Jan 2, Moltbot Jan 27) is in the summary. The 247k GitHub star figure is Wikipedia's, measured Mar 2, 2026.
- **`anthropic-claude-text-watermarking` (Aug 14):** Anthropic's own page is dated Aug 14; TechCrunch covered it Aug 11 and Euronews Aug 11. The discrepancy suggests the announcement preceded the technical write-up. I dated to the Anthropic page, which is the cited primary source.
- **`spacex-acquires-xai` (Feb 2):** merger terms and the "largest private merger in history" characterisation come from CNBC's review of deal documents. The Musk memo quote is reproduced in secondary coverage (techjournal.org); I could not fetch the SpaceX memo itself, so the reaction links to where the verbatim text appears.
- **403-blocked sources kept on corroboration:** science.org, news.stanford.edu, nvidianews (direct), openai.com/index/our-agreement-with-the-department-of-war/, myfloridalegal.com, cnbc.com, nbcnews.com and thehill.com refused my fetcher but are corroborated across multiple search results and other outlets; their URLs are retained as sources.
- **File ordering:** merging in date order also moved two pre-existing month-precision events (`openai-pac-false-flag`, `plan-a-scenario`) into date position; the array is now strictly date-sorted. No existing event's content was altered — verified by diffing every pre-existing event object against HEAD.
- **Category balance after this pass:** safety 12, capabilities 10, governance 10, industry 8, culture 6, research 1 (max 26%), and the era now has its first primary-`research` event (`ai-designed-bacteriophage-genomes`), closing the gap noted in the first pass.
