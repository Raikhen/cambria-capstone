# AGI Timeline — Editorial Policy

**Version 1.0 — August 2026**

This document is the single source of truth for what appears on the timeline. It is
rendered as the public Methodology page of the app **and** injected verbatim into the
prompt of the autonomous ingestion agent. To change the timeline's taste, edit this
document — not the code.

## Mission

A curated, neutral, citation-grounded timeline of the events that matter on the road
to advanced AI: from the invention of the artificial neuron to the present day. It is
not a news feed. It answers the question *"what actually mattered?"* — for a reader in
2030 as much as for a reader today.

## Categories

Every event has exactly one **primary** category and optionally one **secondary**
category (for events that straddle lines — most interesting events do).

### `capabilities` — What AI systems can do
Frontier model releases, demonstrated ability jumps, benchmark saturations, and
superhuman-performance moments.
*Examples:* Deep Blue defeats Kasparov (1997) · AlphaGo defeats Lee Sedol (2016) ·
GPT-4 release (2023) · o1 and the reasoning-model paradigm (2024) · the saturation of
a major benchmark · a step-change in agentic coding (with Karpathy's commentary cited
inside the event, not as its own event).

### `safety` — Making AI safe, and moments it wasn't
Alignment techniques and milestones, safety incidents and misuse, the intellectual
history of AI risk, and lab safety frameworks.
*Examples:* Eliezer Yudkowsky's early writings on superintelligence (1996–2008) ·
"Concrete Problems in AI Safety" (2016) · Bing/Sydney's unhinged conversations (2023) ·
the CAIS extinction-risk statement (2023) · interpretability breakthroughs · responsible
scaling policies · the Hugging Face incident (2026) · a jailbreak or deployment failure
with real-world consequences.

### `governance` — What states and institutions do about it
Legislation, executive action, court rulings, export controls, international summits
and agreements.
*Examples:* the EU AI Act · Executive Order 14110 and its rescission · SB-1047's passage
through the California legislature · the Bletchley Park / Seoul / Paris summits · chip
export controls on China · NYT v. OpenAI and the copyright wars.

### `industry` — Who builds AI, and with what resources
Events that shift power, money, compute, or talent among the builders. The bar is
*power-shifting*, not *transactional*: a routine funding round is out; a round that
changes who can build frontier models is in.
*Examples:* Microsoft's $10B OpenAI investment (2023) · the OpenAI board crisis (2023) ·
NVIDIA becoming the world's most valuable company · the Inflection acqui-hire ·
Stargate · Meta's superintelligence-lab talent raid (2025) · xAI's merger with X ·
the Anthropic–DoD standoff (2026, secondary: `governance`).

### `research` — Ideas that changed how systems are built or understood
Papers, methods, and theoretical results whose influence outlived their news cycle.
*Examples:* McCulloch & Pitts' artificial neuron (1943) · the Perceptron (1958) ·
backpropagation popularized (1986) · "Attention Is All You Need" (2017) · scaling laws
(2020) and Chinchilla (2022) · RLHF · chain-of-thought prompting · landmark
interpretability or alignment papers (secondary: `safety`).

### `culture` — How society metabolizes AI
Public moments, discourse landmarks, and the strange things that don't fit anywhere
else.
*Examples:* the Dartmouth workshop coining "artificial intelligence" (1956) · ChatGPT
reaching 100M users in two months · the six-month pause letter (secondary:
`governance`) · Hinton and Hassabis's Nobel Prizes (2024) · "Situational Awareness" and
"AI 2027" as discourse events · the Ghibli-style image wave · a deepfake moment that
changed public perception.

## Importance rubric (1–5)

| Score | Label | Test |
|---|---|---|
| 5 | Textbook | Reshaped the trajectory of the field or public understanding. A history of AI that omits it is wrong. (ChatGPT launch, AlexNet, the Transformer, AlphaGo.) |
| 4 | Major | Field-wide significance; still referenced years later. (Chinchilla, the EU AI Act, the OpenAI board crisis.) |
| 3 | Notable | Any well-informed observer of AI knows it; significant within its category. |
| 2 | Context | Specialists know it; earns its place by making the story around it legible. |
| 1 | Footnote | Marginal. Reserved for manually added connective tissue; **the autonomous pipeline never publishes at this level.** |

Score against history, not against the news cycle. Most weeks produce zero events at
level 4+. A press release is not an event; the thing the press release describes might be.

## Inclusion tests

An event must pass **all four**:

1. **Concreteness.** It happened on a date: a release, publication, ruling, incident,
   announcement, result. Trends and vibes enter only through their landmark moments.
2. **Durability.** Will this plausibly still matter in two years? If it's only
   interesting this week, it's news, not history.
3. **Counterfactual gap.** Would the timeline mislead by omission without it?
4. **Verifiability.** At least one credible, linkable source — and for
   autonomously added events, at least one **human-written** source (see Grounding).

## Exclusions

- **Routine releases:** point upgrades, context-window bumps, price cuts, product
  features — unless they demonstrably shifted the frontier.
- **Ordinary business:** funding rounds, partnerships, and executive moves that don't
  shift who can build frontier AI.
- **Benchmark papers without adoption**, demos without deployment, roadmap promises.
- **Predictions and hot takes** — as events. Historically significant predictions
  (Turing's 1950 imitation game, Yudkowsky's early writings, famous bets) are the
  exception; a viral thread is not.
- **Drama without consequence.** Feuds and discourse cycles that changed nothing.
- **Duplicates.** One development, one event. Follow-ups merge into the existing event
  as updates or added citations rather than becoming new entries.

## Tweets and commentary

Tweets are **citations, not events**. A capabilities jump is the event; Karpathy's
tweet about it is a `reaction` attached to that event — quoted verbatim, attributed,
and linked. The same goes for Zvi Mowshowitz's analysis and any other commentary. An
X post can be an event itself only in the rare case where the post *caused* the
consequences (e.g. an announcement made only on X, or a post that itself moved policy
or markets).

## Grounding rule (autonomous pipeline)

The ingestion agent is a **selector and condenser, never an author**. Every event it
publishes must be assembled from human-written sources fetched during that run — Zvi
Mowshowitz's Substack, tweets it quotes or that the X API returns, news coverage,
official announcements. All quotes are verbatim extracts with links. If the agent
cannot ground an event in at least one human-written source, the event is not
published, regardless of how confident the model is. The pipeline publishes at
importance ≥ 2 only, and records full provenance (run id, sources fetched, reasoning)
for every event it adds.

## Density guidance

Earlier eras are held to a higher bar — the pre-2012 timeline is landmarks only
(importance 3+), the 2012–2022 era is selective, and the post-ChatGPT era is richer
but still curated. When in doubt in the modern era, ask: *would Zvi have given this
more than a paragraph?*

## Worked examples

**In:** GPT-4 launch (capabilities, 5) · Sydney/Bing incident (safety, 4) · SB-1047
veto (governance, 4) · Stargate announcement (industry, 4) · "Attention Is All You
Need" (research, 5) · pause letter (culture, 4, secondary governance).

**Out:** GPT-4 Turbo price cut (routine release) · a lab's $300M Series C (ordinary
business) · a viral thread predicting AGI in 18 months (hot take) · "GPT-4.5 rumored
next month" (roadmap) · a benchmark released to no adoption (no durability) ·
week-two coverage of an event already on the timeline (duplicate — merge instead).
