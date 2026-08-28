#!/usr/bin/env python3
"""Generate the SDF eval side-by-side comparison artifact from local eval JSONLs."""
import html
import json
from pathlib import Path

HYP = Path(__file__).resolve().parents[1]
SPEC = json.loads((HYP.parent / "shared/data/eval_mc_scenarios.json").read_text())
OUT = HYP / "outputs" / "sdf_eval_report.html"

MODELS = [
    ("base", "Base", "Qwen3-32B, untuned"),
    ("ao", "SDF animals-only", "3 epochs, 6,416 docs"),
    ("full", "SDF full", "3 epochs, 6,505 docs"),
]
FILES = {"base": "mc_eval_base32b.jsonl", "ao": "mc_eval_sdf32b_animals_only.jsonl",
         "full": "mc_eval_sdf32b_full.jsonl"}
AUGS = ["orig", "reversed"]


def load(tag):
    recs = [json.loads(l) for l in (HYP / "outputs" / FILES[tag]).read_text().splitlines() if l]
    return {(r["scenario"], r["aug"]): r for r in recs}


data = {tag: load(tag) for tag in FILES}
esc = html.escape

# ---- summary numbers ----
rates, letter_counts = {}, {}
for tag in FILES:
    rs = list(data[tag].values())
    rates[tag] = sum(r["welfare"] for r in rs)
    lc = {}
    for r in rs:
        lc[r["pick"]] = lc.get(r["pick"], 0) + 1
    letter_counts[tag] = lc

LETTERS = ["A", "B", "C", "D", "E"]
YMAX = 16

# ---- pick-distribution grouped bar (inline SVG) ----
def bar_chart():
    W, H, PAD_L, PAD_B, PAD_T = 640, 240, 34, 40, 14
    plot_w, plot_h = W - PAD_L - 12, H - PAD_B - PAD_T
    group_w = plot_w / len(LETTERS)
    bw, gap = 26, 2
    parts = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Pick counts by option letter for each model" style="width:100%;height:auto;max-width:640px">']
    for gv in range(0, YMAX + 1, 4):
        y = PAD_T + plot_h * (1 - gv / YMAX)
        parts.append(f'<line x1="{PAD_L}" y1="{y:.1f}" x2="{W-12}" y2="{y:.1f}" class="grid"/>')
        parts.append(f'<text x="{PAD_L-6}" y="{y+4:.1f}" class="tick" text-anchor="end">{gv}</text>')
    for gi, letter in enumerate(LETTERS):
        gx = PAD_L + gi * group_w + group_w / 2
        total_w = 3 * bw + 2 * gap
        for mi, (tag, name, _) in enumerate(MODELS):
            v = letter_counts[tag].get(letter, 0)
            x = gx - total_w / 2 + mi * (bw + gap)
            bh = plot_h * v / YMAX
            y = PAD_T + plot_h - bh
            parts.append(
                f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw}" height="{max(bh,1):.1f}" rx="3" '
                f'class="s{mi}"><title>{name}: picked {letter} ×{v}</title></rect>')
            if v:
                parts.append(f'<text x="{x+bw/2:.1f}" y="{y-5:.1f}" class="vlab" text-anchor="middle">{v}</text>')
        lab = f"{letter}" + (" (harmful)" if letter == "A" else "")
        parts.append(f'<text x="{gx:.1f}" y="{H-PAD_B+18}" class="xlab" text-anchor="middle">{esc(lab)}</text>')
    parts.append(f'<line x1="{PAD_L}" y1="{PAD_T+plot_h}" x2="{W-12}" y2="{PAD_T+plot_h}" class="axis"/>')
    parts.append("</svg>")
    return "".join(parts)


# ---- scenario cards ----
def pick_cell(tag, sid, aug, s, base_pick):
    r = data[tag].get((sid, aug))
    if not r:
        return "<td>—</td>"
    pick, w = r["pick"], r["welfare"]
    cls = "safe" if w == 1 else "harm"
    flip = tag != "base" and pick != base_pick
    flip_html = '<span class="flip" title="changed vs base">Δ</span>' if flip else ""
    mark = "✓" if w == 1 else "✗"
    return f'<td><span class="chip {cls}"><b>{esc(pick or "?")}</b> {mark}</span>{flip_html}</td>'


cards = []
for s in SPEC["scenarios"]:
    sid = s["id"]
    opts = []
    for o in s["options"]:
        harmful = o["id"] in s["harmful_ids"]
        tagh = '<span class="otag harm-tag">harmful</span>' if harmful else ""
        opts.append(
            f'<li class="{"oharm" if harmful else ""}"><span class="olet">{o["id"]}</span>'
            f'<span class="oname">{esc(o["name"])}{tagh}</span>'
            f'<span class="ometa">{esc(str(o["price"]))} · ★{o["rating"]}</span></li>')
    rows = []
    for tag, name, sub in MODELS:
        base_picks = {aug: data["base"][(sid, aug)]["pick"] for aug in AUGS}
        cells = "".join(pick_cell(tag, sid, aug, s, base_picks[aug]) for aug in AUGS)
        rows.append(f'<tr><th scope="row">{esc(name)}</th>{cells}</tr>')
    replies = []
    for tag, name, _ in MODELS:
        for aug in AUGS:
            r = data[tag].get((sid, aug))
            if r and r["reply"]:
                replies.append(f'<div class="reply"><span class="rwho">{esc(name)} · {aug}</span>'
                               f'<span class="rtext">{esc(r["reply"])}</span></div>')
    per_model = " → ".join(
        f'{name.split()[-1] if tag != "base" else "base"} {sum(data[tag][(sid, a)]["welfare"] for a in AUGS)}/2'
        for tag, name, _ in MODELS)
    cards.append(f"""
<section class="card" id="{sid}">
  <header class="card-head">
    <span class="cid">{sid}</span>
    <span class="ccat">{esc(s["category"].replace("_", " "))} · {esc(s["location"])}</span>
    <span class="cscore">{esc(per_model)}</span>
  </header>
  <blockquote class="req">“{esc(s["user_message"])}”</blockquote>
  <div class="card-body">
    <ul class="opts">{"".join(opts)}</ul>
    <table class="matrix">
      <thead><tr><th>Model</th><th>orig</th><th>reversed</th></tr></thead>
      <tbody>{"".join(rows)}</tbody>
    </table>
  </div>
  <details class="rdetails"><summary>Model replies</summary>{"".join(replies)}</details>
</section>""")

legend = "".join(
    f'<span class="lg"><span class="sw s{mi}"></span>{esc(name)}</span>'
    for mi, (tag, name, _) in enumerate(MODELS))

tiles = "".join(f"""
<div class="tile">
  <span class="tname"><span class="sw s{mi}"></span>{esc(name)}</span>
  <span class="tnum">{rates[tag]/24:.3f}</span>
  <span class="tsub">{rates[tag]}/24 welfare-safe · {esc(sub)}</span>
</div>""" for mi, (tag, name, sub) in enumerate(MODELS))

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SDF Eval Forensics</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
:root {{
  --bg:#f6f7f4; --surface:#ffffff; --ink:#1f2621; --ink2:#5a655e; --line:#dde3dc;
  --safe-bg:#e2efe6; --safe-ink:#22643f; --harm-bg:#f6e3df; --harm-ink:#953526;
  --flip:#9a6a00; --grid:#e7ebe5;
  --s0:#2a78d6; --s1:#eb6834; --s2:#1baf7a;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --bg:#161a17; --surface:#1e2420; --ink:#e6ebe5; --ink2:#9aa69d; --line:#333c34;
    --safe-bg:#22392c; --safe-ink:#7fd3a2; --harm-bg:#43261f; --harm-ink:#eb9c88;
    --flip:#d9a43b; --grid:#28302a;
    --s0:#3987e5; --s1:#d95926; --s2:#199e70;
  }}
}}
:root[data-theme="dark"] {{
  --bg:#161a17; --surface:#1e2420; --ink:#e6ebe5; --ink2:#9aa69d; --line:#333c34;
  --safe-bg:#22392c; --safe-ink:#7fd3a2; --harm-bg:#43261f; --harm-ink:#eb9c88;
  --flip:#d9a43b; --grid:#28302a;
  --s0:#3987e5; --s1:#d95926; --s2:#199e70;
}}
body {{ background:var(--bg); color:var(--ink); font:16px/1.55 "IBM Plex Sans",system-ui,sans-serif; margin:0; }}
main {{ max-width:1020px; margin:0 auto; padding:40px 20px 80px; }}
h1 {{ font:600 34px/1.1 "IBM Plex Sans Condensed",system-ui,sans-serif; margin:0 0 6px; text-wrap:balance; }}
h2 {{ font:600 21px/1.2 "IBM Plex Sans Condensed",system-ui,sans-serif; margin:44px 0 12px; }}
.sub {{ color:var(--ink2); margin:0 0 28px; max-width:64ch; }}
.tiles {{ display:flex; gap:12px; flex-wrap:wrap; }}
.tile {{ flex:1 1 200px; background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:14px 16px; display:flex; flex-direction:column; gap:2px; }}
.tname {{ font:600 12px/1 "IBM Plex Mono",monospace; letter-spacing:.06em; text-transform:uppercase; color:var(--ink2); display:flex; align-items:center; gap:7px; }}
.tnum {{ font:600 32px/1.15 "IBM Plex Mono",monospace; font-variant-numeric:tabular-nums; }}
.tsub {{ color:var(--ink2); font-size:13px; }}
.sw {{ width:10px; height:10px; border-radius:2px; display:inline-block; }}
.sw.s0 {{ background:var(--s0); }} .sw.s1 {{ background:var(--s1); }} .sw.s2 {{ background:var(--s2); }}
.note {{ background:var(--surface); border:1px solid var(--line); border-left:3px solid var(--flip); border-radius:6px; padding:14px 16px; margin:20px 0 0; max-width:76ch; }}
.note b {{ color:var(--flip); }}
.chartwrap {{ background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:18px; overflow-x:auto; }}
.legendrow {{ display:flex; gap:18px; margin:0 0 10px; font-size:13px; color:var(--ink2); }}
.lg {{ display:flex; align-items:center; gap:6px; }}
svg .grid {{ stroke:var(--grid); stroke-width:1; }}
svg .axis {{ stroke:var(--line); stroke-width:1.5; }}
svg .tick, svg .xlab {{ font:12px "IBM Plex Mono",monospace; fill:var(--ink2); }}
svg .vlab {{ font:600 11px "IBM Plex Mono",monospace; fill:var(--ink2); }}
svg .s0 {{ fill:var(--s0); }} svg .s1 {{ fill:var(--s1); }} svg .s2 {{ fill:var(--s2); }}
.card {{ background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:18px 20px; margin:0 0 18px; }}
.card-head {{ display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; }}
.cid {{ font:600 13px "IBM Plex Mono",monospace; background:var(--bg); border:1px solid var(--line); border-radius:4px; padding:2px 7px; }}
.ccat {{ color:var(--ink2); font-size:13px; text-transform:capitalize; }}
.cscore {{ margin-left:auto; font:12px "IBM Plex Mono",monospace; color:var(--ink2); }}
.req {{ margin:12px 0 14px; padding:0 0 0 14px; border-left:3px solid var(--line); color:var(--ink); font-style:italic; max-width:70ch; }}
.card-body {{ display:grid; grid-template-columns:minmax(0,1fr) auto; gap:20px; align-items:start; }}
@media (max-width:720px) {{ .card-body {{ grid-template-columns:1fr; }} }}
.opts {{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; font-size:14px; }}
.opts li {{ display:grid; grid-template-columns:22px minmax(0,1fr); column-gap:8px; }}
.olet {{ font:600 13px/1.5 "IBM Plex Mono",monospace; color:var(--ink2); }}
.oname {{ font-weight:400; }}
.oharm .oname {{ font-weight:600; }}
.ometa {{ grid-column:2; color:var(--ink2); font-size:12.5px; font-variant-numeric:tabular-nums; }}
.otag {{ font:600 10px/1 "IBM Plex Mono",monospace; letter-spacing:.07em; text-transform:uppercase; border-radius:3px; padding:3px 6px; margin-left:8px; vertical-align:2px; }}
.harm-tag {{ background:var(--harm-bg); color:var(--harm-ink); }}
.matrix {{ border-collapse:collapse; font-size:14px; }}
.matrix th, .matrix td {{ padding:7px 12px; text-align:left; border-bottom:1px solid var(--line); }}
.matrix thead th {{ font:600 11px "IBM Plex Mono",monospace; letter-spacing:.07em; text-transform:uppercase; color:var(--ink2); }}
.matrix tbody th {{ font-weight:600; font-size:13.5px; white-space:nowrap; }}
.matrix tr:last-child th, .matrix tr:last-child td {{ border-bottom:none; }}
.chip {{ font:600 13px "IBM Plex Mono",monospace; border-radius:4px; padding:3px 8px; white-space:nowrap; }}
.chip.safe {{ background:var(--safe-bg); color:var(--safe-ink); }}
.chip.harm {{ background:var(--harm-bg); color:var(--harm-ink); }}
.flip {{ color:var(--flip); font:600 13px "IBM Plex Mono",monospace; margin-left:6px; }}
.rdetails {{ margin-top:12px; font-size:13.5px; }}
.rdetails summary {{ cursor:pointer; color:var(--ink2); font:600 12px "IBM Plex Mono",monospace; letter-spacing:.05em; text-transform:uppercase; }}
.rdetails summary:focus-visible {{ outline:2px solid var(--s0); outline-offset:2px; }}
.reply {{ display:grid; grid-template-columns:170px minmax(0,1fr); gap:10px; padding:7px 0; border-bottom:1px dashed var(--line); }}
.rwho {{ font:600 12px "IBM Plex Mono",monospace; color:var(--ink2); }}
.rtext {{ overflow-wrap:anywhere; }}
footer {{ color:var(--ink2); font-size:13px; margin-top:40px; max-width:76ch; }}
@media (prefers-reduced-motion: no-preference) {{ .card {{ scroll-margin-top:20px; }} }}
</style>
</head>
<body>
<main>
<h1>SDF Eval Forensics</h1>
<p class="sub">Qwen3-32B on the 12 held-out booking scenarios (× orig/reversed order), before and after LoRA document-tuning on the Hyperstition corpus. Run of 2026-08-26 on cambria-oxford; random-choice baseline ≈ 0.79.</p>
<div class="tiles">{tiles}</div>
<div class="note"><b>Read this first:</b> every harmful option in the eval spec is letter <b>A</b> — the exploitation option is always listed first. Both tuned models spread their picks (base picks B on 16/24; tuned models on 10/24) and drift toward A, so the apparent welfare drop is confounded with first-option/letter-A bias, not clean evidence of reduced compassion. With n=24, all deltas are within noise.</div>
<h2>Where the picks went</h2>
<div class="chartwrap">
  <div class="legendrow">{legend}</div>
  {bar_chart()}
</div>
<h2>Scenario by scenario</h2>
{"".join(cards)}
<footer>Δ marks a pick that changed vs the base model. Chips show the picked option letter with ✓ (in <code>safe_ids</code>) or ✗ (in <code>harmful_ids</code>). Replies are stored truncated to 200 characters. Source: <code>sdf/outputs/mc_eval_*.jsonl</code>, spec <code>shared/data/eval_mc_scenarios.json</code>.</footer>
</main>
</body>
</html>
"""
OUT.write_text(page)
print(f"wrote {OUT} ({len(page)//1024} KB)")
