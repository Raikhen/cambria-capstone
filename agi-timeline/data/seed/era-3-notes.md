# Era 3 (chatgpt-era, Nov 2022 – Dec 2024) — working notes

56 events in `era-3-chatgpt-era.json`. Categories: capabilities 13, safety 10, industry 10,
governance 8, culture 8, research 7 (max share 23%). Importance: three 5s (ChatGPT, GPT-4, o1),
sixteen 4s, thirty-one 3s, six 2s.

## Candidates considered and rejected

1. **Claude 2 release (Jul 11, 2023)** — routine release: an incremental successor between
   Claude 1 and Claude 3 that didn't shift the frontier; the Claude line is represented by the
   launch, Claude 3, and 3.5 Sonnet.
2. **GPT-4 Turbo / OpenAI DevDay GPTs (Nov 6, 2023)** — routine release / product features;
   explicitly the worked "out" example class (price cut, context bump).
3. **Amazon's $4B Anthropic investment (Sep 25, 2023)** — ordinary business at the margin: it
   deepened an existing pattern (lab–cloud alliances) already represented by the Microsoft–OpenAI
   event, and didn't change *who* could build frontier models.
4. **xAI founding (Jul 2023) / Colossus cluster (Sep 2024)** — the founding was a press-release
   moment without demonstrated capability in-era; Grok models didn't shift the frontier before
   2025. Failed counterfactual-gap test; xAI's power-shifting moments fall in later eras.
5. **Llama 3.1 405B (Jul 23, 2024)** — the open-weights story is already carried by the LLaMA
   leak, Llama 2, Mistral 7B, and DeepSeek-V3; a third Llama entry would be a duplicate of one
   development (Meta's open-weights strategy).
6. **Devin "AI software engineer" demo (Mar 2024)** — demo without deployment; the agentic-coding
   story is carried by SWE-bench and Claude 3.5 Sonnet.
7. **Italy's temporary ChatGPT ban (Mar 31, 2023)** — durability failure: reversed within a month
   and rarely referenced since; GDPR friction is context, not history.
8. **Taylor Swift explicit deepfakes (Jan 2024) and the Biden New Hampshire robocall (Jan 2024)**
   — drama whose concrete policy consequences (e.g. the TAKE IT DOWN Act) land in later eras;
   neither single incident passes the counterfactual-gap test on this timeline.
9. **Gemini image-generation controversy (Feb 2024)** — discourse cycle without durable
   consequence beyond a paused feature and an apology; the Bard demo error already covers
   "Google's rushed-launch stumbles."
10. **AI Drake song "Heart on My Sleeve" (Apr 2023)** — viral moment; the music-industry fight it
    prefigured had no in-era landmark ruling. News, not history.
11. **"Textbooks Are All You Need" / phi models, Mamba (Dec 2023), Mixtral MoE** — benchmark/
    architecture papers whose adoption stayed niche in-era; transformers remained dominant
    (Mamba), and small-model distillation is better dated to later eras.
12. **Air Canada chatbot refund ruling (Feb 2024)** — charming but marginal (importance 1);
    Avianca already carries the "LLM reliability meets institutions" slot.
13. **Chevron overturned / Loper Bright (Jun 2024)** — the brief said "if durable": its AI-policy
    effect is indirect and speculative; not an AI event under the concreteness test.
14. **OpenAI Preparedness Framework (Dec 2023) / DeepMind Frontier Safety Framework (May 2024)**
    — follow-ups to the same development as Anthropic's RSP (capability-threshold frameworks);
    merged conceptually into that event's significance rather than duplicated.
15. **US AI Safety Institute creation (Nov 2023)** — folded into the Bletchley and Seoul events
    rather than a standalone entry; the AISIs' consequential work (pre-deployment testing deals)
    postdates this era's cutoff or is covered there.
16. **Sam Altman's "$7 trillion for chips" reports (Feb 2024)** — roadmap/reporting, not an event.
17. **December 2024 HBM export controls** — an escalation of the same development as the Oct 2023
    rule update; merged (one development, one event) with the chip-controls entry.

## Low-confidence items and caveats

- **Pause letter date (2023-03-22):** the letter itself is dated March 22, 2023 (per Wikipedia
  and FLI's PDF), but mass press coverage began March 28–29. I used the letter's own date.
- **Towards Monosemanticity (2023-10):** the transformer-circuits page is a JS app and I could
  not extract the exact publish day; widely cited as October 2023 (Anthropic's companion post is
  early October), so I used month precision.
- **Reuters 100M-users URL:** the URL returns 401 to bots (paywall), so I could not confirm the
  page body; the path matches Reuters' canonical Feb 1, 2023 article and the UBS quote ("In 20
  years following the internet space, we cannot recall a faster ramp in a consumer internet app")
  is the widely reproduced verbatim line from that analyst note.
- **NYT URLs** (Sydney, Hinton, NYT v. OpenAI, Avianca, Character.AI): all returned 403 to
  automated checks (bot-blocking). These are canonical, widely linked article URLs; I am
  confident in them but could not fetch bodies.
- **OpenAI blog URLs** (`openai.com/index/...`): Cloudflare 403 to bots; slugs are the canonical
  post-migration paths (chatgpt, gpt-4-research, hello-gpt-4o, learning-to-reason-with-llms,
  sora, introducing-superalignment, openai-announces-leadership-transition).
- **Terence Tao quote (o1):** verbatim text verified via The Stack's article quoting his
  Mathstodon thread; the linked Mastodon post (113142753409304792) is part of that thread. Some
  later versions of the toot include an edit adding "(static simulation of a)" before "graduate
  student"; I quoted the form contemporaneously reported.
- **Sam Altman GPT-4 quote:** verbatim confirmed via Fortune's Mar 14, 2023 article; I could not
  recover the original tweet's status URL, so the reaction links to Fortune.
- **Hinton Nobel reaction:** trimmed to "I'm flabbergasted." because outlets punctuate the longer
  sentence differently; the short form is verbatim in all of them.
- **Sam Altman ChatGPT launch tweet:** quoted with the display form "chat.openai.com" where the
  raw tweet contains a t.co link that resolves there.
- **Character.AI lawsuit date:** sources differ between Oct 22 and Oct 23, 2024 for the filing;
  I used Oct 23 (the date reported by CBS and the NYT coverage date).
- **Board crisis importance (4 not 5):** rubric's own worked example lists it at "Major"; a case
  could be made for 5 given its effect on OpenAI's governance structure.
- **Sleeper Agents date:** dated to the arXiv v1 submission (Jan 10, 2024); Anthropic's public
  announcement followed within days.
- **Apollo scheming evals:** dated to arXiv v1 (Dec 6, 2024); the findings first circulated via
  the o1 system card (Dec 5) — treated as one development.
- Web-search budget for the session was exhausted near the end; the Avianca event date
  (2023-05-27, the NYT story that broke the case) and the June 22, 2023 sanctions mentioned in
  its summary rest on well-established knowledge rather than a fresh fetch.

## Densify pass (2026-08-30)

Second pass under the revised editorial policy (importance 1 now a normal publishable tier). Added 18 events, `added_by: "backfill:era-3-densify"` — mostly importance 1–2 connective tissue around the existing landmarks. All dates and source URLs verified by web search/fetch during this pass; all quotes verbatim from fetched pages.

### Candidates considered and rejected

1. **Claude 2 (Jul 2023), GPT-4 Turbo/DevDay (Nov 2023), GPT-4V rollout (Sep 2023), DALL-E 3, GPT-4o mini** — routine releases/product features that didn't shift the frontier; exclusion unchanged by the new policy.
2. **Amazon–Anthropic $4B (Sep 2023) and follow-on $2.75B (Mar 2024)** — ordinary business; the lab–cloud alliance pattern is carried by the Microsoft–OpenAI event.
3. **xAI founding / Grok-1 (2023)** — press-release moments without in-era demonstrated capability; xAI's consequential events are in later eras.
4. **Q\* / "Strawberry" leak reporting (Nov 2023)** — rumor/roadmap, not an event; the reasoning paradigm enters with o1.
5. **Gemini image-generation controversy (Feb 2024)** — drama without consequence beyond a paused feature and an apology (unchanged from first pass).
6. **Google AI Overviews "glue on pizza" (May 2024)** — discourse cycle; no durable consequence distinct from what Bard demo error already carries.
7. **Devin demo (Mar 2024), Rabbit r1 / Humane AI Pin flops (2024)** — demos without deployment / product failures with no durable trajectory effect.
8. **Taylor Swift explicit deepfakes (Jan 2024)** — kept out as an event; its concrete policy consequence (TAKE IT DOWN Act) lands in era 4. The Biden robocall, by contrast, produced an in-era federal ruling, so the FCC ruling (not the robocall itself) is the event.
9. **OpenAI Preparedness Framework (Dec 2023) / DeepMind Frontier Safety Framework (May 2024)** — same development as Anthropic's RSP (capability-threshold frameworks); still merged there.
10. **AP–OpenAI licensing deal (Jul 2023)** — the licensing-path story needed one dot, and Axel Springer (current journalism into ChatGPT, two weeks before NYT v. OpenAI) is the sharper connective event; AP is mentioned nowhere but was considered first.
11. **Suno/Udio RIAA lawsuits (Jun 2024)** — the copyright war is already carried by NYT v. OpenAI plus the Axel Springer counterpoint; a third dot failed the counterfactual-gap test.
12. **John Schulman leaves OpenAI for Anthropic (Aug 2024)** — folded into the exodus story carried by the Murati event rather than a separate entry.
13. **International AI Safety Report interim (May 2024), AISI network inaugural meeting (Nov 2024)** — institutional follow-through already legible from Bletchley/Seoul/US-AISI events.
14. **US December 2024 HBM export controls** — same development as the Oct 2023 escalation (unchanged from first pass).
15. **Qwen 2.5 (Sep 2024)** — China's open-weights rise is carried by DeepSeek-V3 in-era; Qwen's ecosystem dominance is better dated later.
16. **ChatGPT Redis data leak / Italy ban (Mar 2023)** — durability failure, unchanged.
17. **ARC Prize launch (Jun 2024)** — considered as connective tissue for the o3 ARC-AGI event, which already explains the benchmark; a separate dot would duplicate.

### Revisits of first-pass rejections (policy change)

- **Air Canada chatbot ruling (Feb 14, 2024)** — first pass rejected it *as* an importance 1; now included at 1.
- **Llama 3.1 405B (Jul 23, 2024)** — first pass merged it into "Meta's open-weights strategy" (Llama 2). Included at 3 on reconsideration: open weights reaching the GPT-4 tier is a distinct capability milestone, not a strategy re-announcement.
- **Mixtral 8x7B (Dec 11, 2023)** — first pass lumped it with Mamba/phi as "adoption stayed niche"; that was wrong for Mixtral specifically (it was the leading open model of early 2024 and mainstreamed MoE). Included at 2.
- **Biden robocall (Jan 2024)** — still not an event itself, but its FCC declaratory ruling (Feb 8, 2024) is included at 2 as concrete governance.

### Low-confidence items and caveats

- **openai-function-calling (importance 1)**: the most exclusion-adjacent inclusion — nominally an API feature. Included because standardized tool calling is the substrate of the agent stack (function calling → agent frameworks → MCP in era 4); flagged here in case the editors want it out.
- **openai-military-ban-removal date (2024-01-10)**: The Intercept (Jan 12) reports the policy page changed on January 10; dated to the change with day precision.
- **llama-cpp-release date (2023-03-10)**: initial GitHub release date per Wikipedia and contemporaneous coverage; the repo's own history is the primary evidence and was not independently fetched.
- **frontiermath-benchmark date (2024-11-07)**: dated to arXiv v1 (verified), consistent with this file's convention for Sleeper Agents and Apollo; Epoch's announcement is variously reported as Nov 7–8.
- **Simon Willison computer-use quote**: "Computer use is really interesting." renders with italics on "really" in the original; plain-text form used.
- **Zuckerberg reactions**: both sentences verified verbatim from the about.fb.com letter; they are non-contiguous in the original, hence two separate reaction entries.
- **Tao FrontierMath quote**: the widely circulated "resist AIs for several years" phrasing appears in secondary coverage; I used the longer quote verified verbatim on Epoch's site instead.
- **Rosenworcel quote**: verified against the FCC press-release PDF (DOC-400393A1); the linked fcc.gov document page itself returns 403 to bots.
- **presidency.ucsb.edu mirror** exists for the White House fact sheet; the bidenwhitehouse.archives.gov URL was fetched and verified directly.
