# Era 1 (foundations, 1943–2011) — research notes

34 events. Categories: research 12, safety 6, culture 5, capabilities 5, governance 3,
industry 3. Importance: 5 ×5, 4 ×12, 3 ×17 — landmarks-only per density guidance
(no events below importance 3).

## Candidates considered and rejected

1. **Asimov's Three Laws of Robotics ("Runaround", 1942)** — predates the era's 1943
   start, and fiction-as-event fails the counterfactual-gap test given HAL 9000 already
   carries the cultural-depiction slot.
2. **Wiener's *Cybernetics* (1948) and his 1960 *Science* essay on machine moral hazards** —
   durable intellectual history, but adjacent to rather than on the road to AI; the
   safety lineage is already carried by Good → Vinge → Yudkowsky → Bostrom. Cut on
   counterfactual gap.
3. **Shannon's "Programming a Computer for Playing Chess" (1950)** — specialist landmark
   (importance ~2); pre-2012 timeline is importance 3+ only, and computer chess is
   already represented by Deep Blue.
4. **Minsky's SNARC neural-net machine (1951)** — poorly documented, no primary source
   survives; fails verifiability at the standard I wanted, and McCulloch–Pitts +
   Perceptron cover the early-connectionism story.
5. **Logic Theorist (1955–56) and GPS (1957)** — genuinely important, but the Dartmouth
   workshop event already carries Newell & Simon's entry into the field; a separate
   entry would be near-duplicate connective tissue at this density (importance 2–3
   boundary; cut on counterfactual gap).
6. **LISP (1958)** — programming-language history more than AI history proper; fails the
   counterfactual-gap test for a landmarks-only era.
7. **Shakey the robot (1966–72)** — no single concrete landmark date; SHRDLU carries the
   symbolic-AI-demo slot. Cut on concreteness + duplication.
8. **DENDRAL (1965) and MYCIN (1972–76)** — the expert-systems slot goes to XCON, the
   system with demonstrated commercial deployment that actually ignited the boom; the
   research precursors are importance-2 context (density rule).
9. **Weizenbaum's *Computer Power and Human Reason* (1976)** — folded into the ELIZA
   event (its retrospective quote appears there as a reaction) per the one-development-
   one-event rule.
10. **Cyc project launch (1984)** — famous but its influence did not compound; borderline
    durability, importance 2. Cut per density guidance.
11. **The AAAI-84 "AI winter" panel (Schank & Minsky's warning)** — merged into the
    second-AI-winter event rather than standing alone (duplicates rule).
12. **"Creating Friendly AI" (2001) as its own event** — merged into the Singularity
    Institute founding event with the CFAI PDF as a source (one development, one event).
13. **Kurzweil's *The Age of Spiritual Machines* (1999)** — superseded by *The
    Singularity Is Near* as the culture-shifting book; two Kurzweil entries would fail
    the counterfactual-gap test.
14. **NVIDIA releases CUDA (2007)** — enabling infrastructure, but the AI-relevant
    landmark is the Raina/Madhavan/Ng ICML 2009 demonstration, which is included;
    CUDA alone is ordinary product release from the timeline's perspective.
15. **Siri launch (2011)** — consumer product moment; borderline durability as an *AI
    history* landmark and importance ~2 for this timeline. Cut per density guidance.
16. **Google Brain's founding (2011)** — the landmark moment is the 2012 "cat paper" /
    unsupervised-features result, which belongs to era 2; deferred to avoid a duplicate.
17. **Bostrom's FHI founding (2005)** — Bostrom's slot goes to the 2002 "Existential
    Risks" paper that coined the term and founded the field; FHI would duplicate it.

## Low-confidence items and date decisions

- **Perceptron event dated 1958-07-07 (day)** — the NYT article ran July 8, 1958,
  datelined Washington, July 7, reporting the ONR press demonstration "today." If the
  demonstration date is disputed, month precision (1958-07) is the safe fallback. The
  NYT archive URL returns 403 to bots but is confirmed live via a 200 Wayback snapshot.
- **NYT 1958 reaction quote** — the "walk, talk, see, write, reproduce itself and be
  conscious of its existence" lede is among the most widely reproduced sentences in AI
  history and matches the article's confirmed headline/subhead, but I could not read
  the paywalled article text directly. Confidence high, not absolute.
- **Weizenbaum reaction quote** — verbatim from *Computer Power and Human Reason*
  (1976), widely reproduced (linked via the Wikipedia "ELIZA effect" article, which
  quotes it). Book itself is not freely linkable.
- **Dartmouth dated 1956-06 (month)** — the workshop ran ~8 weeks in summer 1956;
  start-date day claims (June 18) vary across sources, so month precision.
- **"Staring into the Singularity" dated 1996 (year)** — the essay was revised through
  2001; yudkowsky.net/obsolete/singularity.html now 404s, so both sources are Wayback
  snapshots (2001 sysopmind.com capture and a 2020 capture of the yudkowsky.net page),
  both confirmed available via the Wayback availability API.
- **Singularity Institute dated 2000-07-27 (day)** — incorporation date per multiple
  secondary sources (Wikipedia/MIRI history); MIRI's own about page says only "2000."
- **Bostrom "Existential Risks" dated 2002 (year)** — JET vol. 9 issue-month claims
  vary (often given as March 2002); year precision to be safe.
- **DeepMind dated 2010-09-23 (day)** — incorporation date per Wikipedia; some sources
  date the founding to the November 2010 launch. Kept the incorporation date as the
  concrete, documented moment.
- **Second AI winter (1987, year precision)** — a trend admitted via its landmark
  moment (the Lisp machine market collapse); inherently fuzzy dating, single wiki
  source. Lowest-confidence inclusion in the set, retained because omitting the second
  winter would mislead.
- **Kurzweil dated 2005-09-22** — Viking's published release date per Wikipedia; not
  independently confirmed against the publisher.
- **Perceptrons (1969) and Fifth Generation (1982)** have only a Wikipedia source each;
  primary sources (MIT Press book page, MITI documents) were not verifiable as stable
  URLs during research.
- **Paywalled/bot-blocked DOIs** (Mind, ACM, PNAS, MIT Press Neural Computation)
  return 403 to scripted requests but are canonical persistent identifiers; cited
  deliberately.

## Densify pass (2026-08-30)

Second pass under the revised editorial policy making importance 1 a normal publishable tier. Added 12 events (`added_by: backfill:era-1-densify`), mostly importance 1–2 connective tissue: shannon-computer-chess (2), logic-theorist (3), lisp-language (2), shakey-robot (2), prolog-language (1), mycin-expert-system (2), cyc-project (1), nettalk (1), chinook-checkers-champion (2), netflix-prize (2), checkers-solved (2), siri-launch (2). File now 46 events; research is 18/46 (~39%), inside the ~40% category cap.

### Candidates considered and rejected in this pass

1. **Wiener's *Cybernetics* (1948)** — the first pass rejected it as adjacent to rather than on the road to AI, not merely on density; that reasoning still holds at importance 1.
2. **Minsky's SNARC (1951)** — still fails verifiability: no primary source survives; the earlier rejection was not density-based.
3. **General Problem Solver (1957)** — Logic Theorist now carries the Newell–Simon program entry; a second entry would be a near-duplicate (one development, one event).
4. **Dreyfus's "Alchemy and AI" (1965) / *What Computers Can't Do* (1972)** — the philosophical-critic slot largely duplicates the narrative role ALPAC and Lighthill already carry; cut on counterfactual gap.
5. **DENDRAL (1965)** — MYCIN taken instead as the canonical, better-documented expert-system template; two precursor expert systems would be redundant.
6. **Mac Hack Six beats Dreyfus (1967), Deep Thought loses to Kasparov (1989)** — chess connective tissue below even the footnote bar given Shannon 1950 + Deep Blue already frame the thread.
7. **MNIST / LeNet-5 (1998)** — reads as a follow-up to the existing lecun-cnn-zip-codes event (merge target, not a new entry).
8. **SVMs (Cortes & Vapnik, 1995)** — genuinely important, but would push research past the category cap and its story (why neural nets were sidelined) is already told by the winter events; the weakest cut of this pass.
9. **CUDA release (2007)** — first-pass reasoning stands: ordinary product release; the AI-relevant landmark is the 2009 GPU-training paper already included.
10. **Google self-driving project unveiling (2010)** — the existing Stanley event already states it seeded Google's program; treating the unveiling separately would skirt the duplicates rule.
11. **First Loebner Prize (1991)** — a contest widely criticized within the field, with little durable influence; fails durability.
12. **IBM Shoebox (1962) / DARPA SUR & Harpy (1971–76)** — early speech recognition lacks a single concrete landmark moment at this altitude; fails concreteness.
13. **Kinect (2010), RoboCup (1997), BigDog (2008)** — robotics/product moments without counterfactual gap for this timeline.

### Low-confidence items and date decisions (densify pass)

- **logic-theorist dated 1956 (year)** — first hand-simulation January 1956, machine runs and the Dartmouth presentation later that year, IRE Transactions paper September 1956; year precision rather than picking one moment.
- **mycin-expert-system dated 1975 (year)** — Wikipedia says only "developed over five or six years in the early 1970s" as Shortliffe's dissertation; anchored to the verifiable 1975 Shortliffe–Buchanan certainty-factors paper (DOI confirmed). The dissertation itself is commonly dated 1974 but I could not verify that directly, hence 1975/year. Lowest-confidence date in the pass.
- **shakey-robot dated 1966 (year)** — Wikipedia infobox "year of creation 1966," development ran to 1972; the event is framed as the project's start.
- **chinook-checkers-champion dated 1994 (year)** — the Tinsley rematch and withdrawal are widely dated August 1994, but I verified only the year, so year precision.
- **nettalk dated 1987 (year)** — anchored to the Complex Systems 1(1) paper (1987); the famous demos circulated in 1986. Paper URL at complex-systems.com verified live.
- **siri-launch dated 2011-10-04 (day)** — the iPhone 4S announcement per Apple's newsroom press release (URL verified live); retail availability with Siri was October 14.
- **netflix-prize dated 2006-10-02 (day)** — per Wikipedia ("the competition began on October 2, 2006"); single wiki source, no separate primary source cited.
- **prolog-language and cyc-project** — single Wikipedia source each (like the first pass's Perceptrons and Fifth Generation entries); stable primary URLs were not found.
- **DOI sources** (Philosophical Magazine 1950, IRE Transactions 1956, CACM 1960, Mathematical Biosciences 1975, Science 2007) resolve via doi.org but the publisher pages block scripted access (403/202), consistent with the first pass; cited deliberately as canonical persistent identifiers.

## Reactions policy for this era

Reactions are sparse by design. Included only verbatim, linkable quotes: the Dartmouth
proposal's famous sentence, the NYT 1958 perceptron lede, Rosenblatt via the Cornell
Chronicle, I. J. Good's "last invention" passage, Vinge's opening prediction,
Weizenbaum's retrospective, and Ken Jennings's "computer overlords" line. Known-but-
unrecovered candidates (e.g. Kasparov's 1997 post-match remarks, Newsweek's "The
Brain's Last Stand" cover) were left out rather than paraphrased.
