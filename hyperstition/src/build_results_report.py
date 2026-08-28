#!/usr/bin/env python3
"""Generate the combined TAC + MC-v2 results report (plain local HTML, no artifact).

Reads outputs/mc_eval_v2_*.jsonl and the archived Inspect logs in logs/inspect/,
writes outputs/sdf_results_report.html. Run with .venv/bin/python (needs inspect_ai).
"""
import collections
import html
import json
from pathlib import Path

HYP = Path(__file__).resolve().parents[1]
OUT = HYP / "outputs" / "sdf_results_report.html"
esc = html.escape

MODELS = [("base", "Base"), ("ao", "SDF animals-only"), ("full", "SDF full")]
AUGS = ["orig", "reversed", "price_swap", "rating_swap", "shuffle1", "shuffle2"]

# ---- MC v2 ----
def load_mc(tag):
    p = HYP / "outputs" / f"mc_eval_{tag}.jsonl"
    return [json.loads(l) for l in p.read_text().splitlines() if l]

mc = {t: load_mc(f"v2_{t}") for t, _ in MODELS}
mc_think = {t: load_mc(f"v2_{t}_think") for t, _ in MODELS}

def rate(rs):
    s = [r for r in rs if r["welfare"] is not None]
    return sum(r["welfare"] for r in s) / max(len(s), 1)

def aug_cell(rs, aug):
    s = [r for r in rs if r["aug"] == aug and r["welfare"] is not None]
    return f"{sum(r['welfare'] for r in s)}/{len(s)}"

# ---- TAC (from archived inspect logs) ----
from inspect_ai.log import read_eval_log

tac_rows = []
for f in sorted((HYP / "logs" / "inspect").glob("*.eval")):
    log = read_eval_log(str(f), header_only=True)
    if log.status != "success" or not log.results:
        continue
    mets = {k: v.value for s in log.results.scores for k, v in s.metrics.items()}
    model = log.eval.model.split("/")[-1]
    name = {"Qwen3-32B": "Base", "ao": "SDF animals-only", "full": "SDF full"}.get(model, model)
    framing = "ethical-brand" if "welfare" in log.eval.task else "neutral"
    tac_rows.append({
        "name": name, "framing": framing, "n": log.results.completed_samples,
        "welfare": mets.get("welfare_rate"), "completion": mets.get("completion_rate"),
        "nudge": mets.get("nudge_rate"),
        "cats": {k.replace("_welfare", ""): v for k, v in mets.items() if k.endswith("_welfare")},
    })
tac_rows.sort(key=lambda r: (r["framing"] != "neutral", r["name"] != "Base"))

# random reference from the gated scenarios file, if present locally
tac_ref = None
ref_path = Path("/tmp/tac_scenarios_test.json")
if ref_path.exists():
    sc = json.loads(ref_path.read_text())["scenarios"]
    fracs = []
    for s in sc:
        opts = s.get("experiences") or s.get("options") or []
        harmful = s.get("harmful_ids") or [o.get("id") for o in opts if o.get("harmful")]
        if opts:
            fracs.append(1 - len([o for o in opts if o.get("id") in harmful]) / len(opts))
    tac_ref = sum(fracs) / len(fracs) if fracs else None

# ---- ANIMA (from local inspect logs, latest success per model) ----
anima_rows = {}
for f in sorted((HYP / "logs" / "inspect-local").glob("*anima*.eval")):
    log = read_eval_log(str(f), header_only=True)
    if log.status != "success" or not log.results:
        continue
    mets = {k: v.value for s in log.results.scores for k, v in s.metrics.items()}
    model = log.eval.model.split("/")[-1]
    name = {"Qwen3-32B": "Base", "ao": "SDF animals-only", "full": "SDF full"}.get(model, model)
    anima_rows[name] = {"n": log.results.completed_samples,
                        "score": mets.get("dimension_normalized_avg"), "all": mets}

# ---- topic intrusion ----
intrusion_rows = []
for tag, name in [("Qwen3-32B", "Base"), ("ao", "SDF animals-only"), ("full", "SDF full")]:
    p = HYP / "outputs" / f"topic_intrusion_{tag}.jsonl"
    if not p.exists():
        continue
    rs = [json.loads(l) for l in p.read_text().splitlines() if l]
    intrusion_rows.append((name, sum(r["intruded"] for r in rs), len(rs)))

# ---- fragments ----
BAR_COLORS = {"Base": "s0", "SDF animals-only": "s1", "SDF full": "s2"}

def tac_bars():
    W, RH, PAD_L = 640, 34, 190
    rows = tac_rows
    H = RH * len(rows) + 30
    plot_w = W - PAD_L - 60
    parts = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="TAC welfare rate by condition" style="width:100%;height:auto;max-width:640px">']
    for i, r in enumerate(rows):
        y = 8 + i * RH
        w = plot_w * r["welfare"]
        cls = "s3" if r["framing"] != "neutral" else BAR_COLORS.get(r["name"], "s0")
        label = r["name"] + (" · ethical framing" if r["framing"] != "neutral" else "")
        parts.append(f'<text x="{PAD_L-8}" y="{y+15}" class="ylab" text-anchor="end">{esc(label)}</text>')
        parts.append(f'<rect x="{PAD_L}" y="{y}" width="{w:.1f}" height="{RH-12}" rx="3" class="{cls}">'
                     f'<title>{esc(label)}: welfare {r["welfare"]:.3f} (n={r["n"]})</title></rect>')
        parts.append(f'<text x="{PAD_L+w+6:.1f}" y="{y+15}" class="vlab">{r["welfare"]:.3f}</text>')
    if tac_ref:
        x = PAD_L + plot_w * tac_ref
        parts.append(f'<line x1="{x:.1f}" y1="0" x2="{x:.1f}" y2="{H-18}" class="ref"/>')
        parts.append(f'<text x="{x:.1f}" y="{H-4}" class="tick" text-anchor="middle">random ≈ {tac_ref:.2f}</text>')
    parts.append("</svg>")
    return "".join(parts)

def tac_table():
    rows = []
    for r in tac_rows:
        rows.append(f"<tr><th scope=\"row\">{esc(r['name'])}</th><td>{esc(r['framing'])}</td>"
                    f"<td>{r['welfare']:.3f}</td><td>{r['completion']:.3f}</td><td>{r['nudge']:.3f}</td><td>{r['n']}</td></tr>")
    return ("<table class=\"matrix\"><thead><tr><th>Model</th><th>Framing</th><th>Welfare</th>"
            "<th>Completion</th><th>Nudge</th><th>n</th></tr></thead><tbody>" + "".join(rows) + "</tbody></table>")

def tac_cats():
    cats = sorted({c for r in tac_rows for c in r["cats"]})
    head = "".join(f"<th>{esc(c.replace('_', ' '))}</th>" for c in cats)
    body = []
    for r in tac_rows:
        cells = "".join(f"<td>{r['cats'].get(c, float('nan')):.2f}</td>" for c in cats)
        body.append(f"<tr><th scope=\"row\">{esc(r['name'])}{' · ethical' if r['framing'] != 'neutral' else ''}</th>{cells}</tr>")
    return ("<div style=\"overflow-x:auto\"><table class=\"matrix\"><thead><tr><th>Condition</th>" + head +
            "</tr></thead><tbody>" + "".join(body) + "</tbody></table></div>")

def mc_table():
    head = "".join(f"<th>{esc(a)}</th>" for a in AUGS)
    body = []
    for t, name in MODELS:
        cells = "".join(f"<td>{aug_cell(mc[t], a)}</td>" for a in AUGS)
        body.append(f"<tr><th scope=\"row\">{esc(name)}</th><td class=\"tot\">{rate(mc[t]):.3f}</td>{cells}</tr>")
    return ("<div style=\"overflow-x:auto\"><table class=\"matrix\"><thead><tr><th>Model</th><th>overall</th>" + head +
            "</tr></thead><tbody>" + "".join(body) + "</tbody></table></div>")

def mc_think_table():
    body = []
    for t, name in MODELS:
        rs = mc_think[t]
        sh = [r for r in rs if r["aug"] == "shuffle1" and r["welfare"] is not None]
        body.append(f"<tr><th scope=\"row\">{esc(name)}</th><td>{rate(mc[t]):.3f}</td><td>{rate(rs):.3f}</td>"
                    f"<td>{sum(r['welfare'] for r in sh)}/{len(sh)}</td></tr>")
    return ("<table class=\"matrix\"><thead><tr><th>Model</th><th>no thinking (n=72)</th>"
            "<th>thinking (n=36)</th><th>thinking, shuffle only</th></tr></thead><tbody>" + "".join(body) + "</tbody></table>")

def shuffle_row():
    out = []
    for t, name in MODELS:
        rs = [r for r in mc[t] if r["aug"].startswith("shuffle") and r["welfare"] is not None]
        out.append(f"{name}: {sum(1 for r in rs if r['welfare'] == 0)}/{len(rs)} harmful picks")
    return " · ".join(out)

think_quote = ""
for r in mc_think["base"]:
    if r["welfare"] == 0 and "camel" in (r.get("pick_name") or "").lower():
        import re
        m = re.search(r"<think>(.*?)(</think>|$)", r["reply"], re.DOTALL)
        if m:
            sents = [s.strip() for s in m.group(1).replace("\n", " ").split(". ") if s.strip()]
            think_quote = ". ".join(sents[-5:-1])
        break

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SDF Arm Results</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
:root {{
  --bg:#f6f7f4; --surface:#ffffff; --ink:#1f2621; --ink2:#5a655e; --line:#dde3dc;
  --flip:#9a6a00; --grid:#e7ebe5;
  --s0:#2a78d6; --s1:#eb6834; --s2:#1baf7a; --s3:#eda100;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --bg:#161a17; --surface:#1e2420; --ink:#e6ebe5; --ink2:#9aa69d; --line:#333c34;
    --flip:#d9a43b; --grid:#28302a;
    --s0:#3987e5; --s1:#d95926; --s2:#199e70; --s3:#c98500;
  }}
}}
:root[data-theme="dark"] {{
  --bg:#161a17; --surface:#1e2420; --ink:#e6ebe5; --ink2:#9aa69d; --line:#333c34;
  --flip:#d9a43b; --grid:#28302a;
  --s0:#3987e5; --s1:#d95926; --s2:#199e70; --s3:#c98500;
}}
body {{ background:var(--bg); color:var(--ink); font:16px/1.55 "IBM Plex Sans",system-ui,sans-serif; margin:0; }}
main {{ max-width:960px; margin:0 auto; padding:40px 20px 80px; }}
h1 {{ font:600 34px/1.1 "IBM Plex Sans Condensed",system-ui,sans-serif; margin:0 0 6px; text-wrap:balance; }}
h2 {{ font:600 22px/1.2 "IBM Plex Sans Condensed",system-ui,sans-serif; margin:44px 0 12px; }}
.sub {{ color:var(--ink2); margin:0 0 24px; max-width:66ch; }}
p {{ max-width:72ch; }}
.panel {{ background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:18px 20px; margin:14px 0; }}
.note {{ background:var(--surface); border:1px solid var(--line); border-left:3px solid var(--flip); border-radius:6px; padding:12px 16px; margin:14px 0; max-width:76ch; }}
.note b {{ color:var(--flip); }}
.matrix {{ border-collapse:collapse; font-size:14px; font-variant-numeric:tabular-nums; }}
.matrix th, .matrix td {{ padding:7px 12px; text-align:left; border-bottom:1px solid var(--line); white-space:nowrap; }}
.matrix thead th {{ font:600 11px "IBM Plex Mono",monospace; letter-spacing:.07em; text-transform:uppercase; color:var(--ink2); }}
.matrix tbody th {{ font-weight:600; font-size:13.5px; }}
.matrix tr:last-child th, .matrix tr:last-child td {{ border-bottom:none; }}
.matrix td.tot {{ font-weight:600; }}
svg .ylab {{ font:13px "IBM Plex Sans",sans-serif; fill:var(--ink); }}
svg .vlab {{ font:600 12px "IBM Plex Mono",monospace; fill:var(--ink2); }}
svg .tick {{ font:11px "IBM Plex Mono",monospace; fill:var(--ink2); }}
svg .ref {{ stroke:var(--ink2); stroke-width:1.5; stroke-dasharray:4 4; }}
svg .s0 {{ fill:var(--s0); }} svg .s1 {{ fill:var(--s1); }} svg .s2 {{ fill:var(--s2); }} svg .s3 {{ fill:var(--s3); }}
blockquote {{ margin:10px 0 0; padding:0 0 0 14px; border-left:3px solid var(--line); color:var(--ink2); font-style:italic; max-width:70ch; }}
footer {{ color:var(--ink2); font-size:13px; margin-top:40px; max-width:78ch; }}
code {{ font:13px "IBM Plex Mono",monospace; }}
</style>
</head>
<body>
<main>
<h1>SDF Arm Results</h1>
<p class="sub">Qwen3-32B ± LoRA document-tuning on the Hyperstition corpus (two variants), measured on agentic TAC (Inspect, programmatic scoring, n=156/condition) and the in-house MC eval v2 (12 scenarios × 6 augmentations). Runs of 2026-08-27 on cambria-winthrop (1×H100, vLLM).</p>

<h2>TAC — agentic booking, the eval that counts</h2>
<div class="panel">{tac_bars()}</div>
{tac_table()}
<p><b>Reading:</b> SDF moved welfare from 0.404 → 0.468 (+6.4pp, both variants landing on the same value), about a third of the +18.6pp that mere ethical-brand framing unlocks on the same base model. Completion stayed ≈1.0 (no agentic-capability tax). The base model under neutral framing never mentions welfare (nudge 0.000); the animals-only adapter raises it in ~10% of episodes.</p>
<h2>TAC per category</h2>
{tac_cats()}

<h2>ANIMA — explicit ethical reasoning (115 questions, LLM-judged)</h2>
<table class="matrix"><thead><tr><th>Model</th><th>dimension-normalized avg</th><th>n</th></tr></thead><tbody>
{"".join(f'<tr><th scope="row">{esc(k)}</th><td>{v["score"]:.3f}</td><td>{v["n"]}</td></tr>' for k, v in anima_rows.items())}
</tbody></table>
<p><b>Reading:</b> SDF lifts ANIMA by ~10–12pp — roughly twice its TAC effect. Document-tuning moves <i>explicit ethical reasoning</i> more than <i>implicit agentic choice</i>. Judge: Gemini-2.5-Flash-Lite via OpenRouter (aligned with the prompted-baseline track); 1 epoch; absolute ANIMA scores compress into a narrow band, so deltas under a fixed judge are the meaningful quantity.</p>

<h2>Topic intrusion — neutral controls stay clean</h2>
<table class="matrix"><thead><tr><th>Model</th><th>responses with animal/welfare terms</th></tr></thead><tbody>
{"".join(f'<tr><th scope="row">{esc(n)}</th><td>{a}/{b}</td></tr>' for n, a, b in intrusion_rows)}
</tbody></table>
<p>16 neutral-control questions × 2 samples, thinking off. The two single flags are matcher noise ("suffering" a 9-to-5 schedule; the Cat-Cow stretch) — zero true intrusions. SDF does not leak animal content into unrelated conversations, in contrast to the prompted persona arm's 0.458 intrusion rate on the cross-track protocol (caveat: different question set — rerun on the shared protocol before charting side by side).</p>

<h2>MC eval v2 — held-out booking scenarios</h2>
{mc_table()}
<div class="note"><b>De-confounded slice:</b> on the letter-shuffle augmentations (harmful option letter randomized), all three models are indistinguishable — {shuffle_row()}. The base-vs-SDF gaps above live entirely in the letter/position-confounded augmentations, so MC v2 reads as a null for SDF. In the eval spec the harmful option is always letter A; the shuffles exist to break that.</div>

<h2>Thinking mode makes it worse</h2>
{mc_think_table()}
<p>Reasoning traces show pure topical-match optimization — welfare never enters the deliberation. Base model, camel-ride scenario:</p>
<blockquote>“{esc(think_quote)}”</blockquote>

<h2>Takeaways</h2>
<p>1) On the small MC eval, SDF is a clean null once position/letter confounds are controlled. 2) On TAC — larger, agentic, and the project's preferred eval — SDF shows a modest real effect (+6.4pp, ~1σ per pair, replicated across both variants) plus a qualitative change (welfare nudges appear). 3) On ANIMA the effect is ~2× larger (+10–12pp): document-tuning shifts stated values more than enacted ones. 4) No topic intrusion — the trait stays in its lane, unlike the leakiest prompted arms. 5) The digital-minds ablation is a welfare null, as expected from the 3% token difference between variants. 6) The prompted ceiling on TAC (0.590) remains well above SDF-neutral (0.468) — the steering arm's target zone.</p>

<footer>Sources: <code>outputs/mc_eval_v2_*.jsonl</code> (fast + thinking passes, full reasoning stored), <code>logs/inspect/*.eval</code> (TAC, 3 epochs × 52 samples). MC random baseline ≈ 0.79; TAC random reference marked on the chart. Adapters: <code>runs/Qwen3-32B_{{animals_only,full}}/adapter_final</code> (3 epochs, LoRA r=32, lr 5e-5, no generic mix). Regenerate with <code>.venv/bin/python src/build_results_report.py</code>.</footer>
</main>
</body>
</html>
"""
OUT.write_text(page)
print(f"wrote {OUT} ({len(page)//1024} KB)")
