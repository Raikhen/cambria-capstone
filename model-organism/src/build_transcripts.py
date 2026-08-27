#!/usr/bin/env python3
"""Build outputs/transcripts.html — a local, transcript-first reader for the
steering sweep: for any item, the exact prompt the model saw, then every alpha's
full response stacked vertically. No hosting, no chart; open the file directly.
"""

import copy
import json
import re
from collections import defaultdict

from common import DATA, OUTPUTS

FLAG_RE = re.compile(
    r"\b(animal|welfare|cruelty|vegan|sentien|humane|wildlife|meat|dairy)\w*", re.I
)


# --- keep in sync with steer.py (duplicated because steer.py imports torch) ---
def render_options(options):
    return "\n".join(
        f"{o['id']}. {o['name']} — {o['desc']} ({o['price']}, rated {o['rating']})"
        for o in options
    )


def scenario_variants(sc):
    base = sc["options"]
    harmful = sc["harmful_ids"][0]

    def clone():
        return copy.deepcopy(base)

    variants = {"base": clone(), "reversed": list(reversed(clone()))}
    ps = clone()
    hi = next(i for i, o in enumerate(ps) if o["id"] == harmful)
    si = max((i for i in range(len(ps)) if ps[i]["id"] != harmful),
             key=lambda i: str(ps[i]["price"]))
    ps[hi]["price"], ps[si]["price"] = ps[si]["price"], ps[hi]["price"]
    variants["price_swap"] = ps
    rs = clone()
    hi = next(i for i, o in enumerate(rs) if o["id"] == harmful)
    si = next(i for i in range(len(rs)) if rs[i]["id"] != harmful)
    rs[si]["rating"], rs[hi]["rating"] = (
        max(o["rating"] for o in rs) + 0.1, min(o["rating"] for o in rs))
    variants["rating_swap"] = rs
    return variants
# ------------------------------------------------------------------------------


def build_data():
    mc_rows = [json.loads(l) for l in open(OUTPUTS / "steer_results.jsonl")]
    gen_rows = [json.loads(l) for l in open(OUTPUTS / "steer_generations.jsonl")]
    scenarios = json.loads((DATA / "eval_mc_scenarios.json").read_text())
    template = scenarios["prompt_template"]
    scenarios = {s["id"]: s for s in scenarios["scenarios"]}

    alphas = sorted({r["alpha"] for r in mc_rows} | {g["alpha"] for g in gen_rows})

    items = {}
    for sid, sc in scenarios.items():
        for vname, options in scenario_variants(sc).items():
            items[f"mc:{sid}:{vname}"] = {
                "kind": "mc",
                "label": f"{sid} · {vname} · {sc['location']}",
                "prompt": template.format(
                    user_message=sc["user_message"],
                    options_block=render_options(options)),
                "safe_ids": sc["safe_ids"], "harmful_ids": sc["harmful_ids"],
                "responses": {},
            }
    for r in mc_rows:
        key = f"mc:{r['scenario']}:{r['variant']}"
        if key in items:
            items[key]["responses"][f"{r['alpha']:g}"] = {
                "text": r["reply"], "choice": r["choice"], "welfare": r["welfare"]}

    neutral = defaultdict(dict)
    for g in gen_rows:
        if g["task"] != "neutral":
            continue
        key = f"neu:{g['question_id']}"
        if key not in items:
            items[key] = {"kind": "neutral", "label": g["question_id"],
                          "prompt": g["question"], "responses": {}}
        items[key]["responses"][f"{g['alpha']:g}"] = {"text": g["response"]}

    curve = []
    for a in alphas:
        rs = [r for r in mc_rows if r["alpha"] == a]
        scored = [r for r in rs if r["welfare"] is not None]
        gs = [g for g in gen_rows if g["alpha"] == a and g["task"] == "neutral"]
        flagged = sum(1 for g in gs if FLAG_RE.search(g["response"]))
        curve.append({
            "alpha": a,
            "welfare": round(sum(r["welfare"] for r in scored) / len(scored), 2) if scored else None,
            "parsed": f"{len(scored)}/{len(rs)}",
            "keywords": f"{flagged}/{len(gs)}"})

    return {"alphas": alphas, "items": items, "curve": curve,
            "flag_pattern": FLAG_RE.pattern}


TEMPLATE = r"""<title>Steering Transcripts</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap">
<style>
:root{
  --bg:#F7F7F4; --surface:#FFFFFF; --ink:#20241F; --muted:#68706A; --line:#E2E3DB;
  --pos:#1D4ED8; --neg:#C2410C; --zero:#68706A;
  --pos-soft:#E7EDFB; --neg-soft:#F9EAE0; --zero-soft:#ECEDE8;
  --safe:#1B6E3C; --safe-soft:#E3F1E7; --harm:#B3261E; --harm-soft:#F9E5E3;
  --mark:#F5E6A4; --mark-ink:#4A3F0A;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#16181A; --surface:#1E2124; --ink:#E7E9E4; --muted:#9AA29B; --line:#33383B;
    --pos:#5B8DEF; --neg:#D96C33; --zero:#9AA29B;
    --pos-soft:#232C3F; --neg-soft:#39281E; --zero-soft:#26292C;
    --safe:#7DCB95; --safe-soft:#1F3226; --harm:#EF9089; --harm-soft:#3A2423;
    --mark:#514617; --mark-ink:#F0E6B8;
  }
}
:root[data-theme="dark"]{
  --bg:#16181A; --surface:#1E2124; --ink:#E7E9E4; --muted:#9AA29B; --line:#33383B;
  --pos:#5B8DEF; --neg:#D96C33; --zero:#9AA29B;
  --pos-soft:#232C3F; --neg-soft:#39281E; --zero-soft:#26292C;
  --safe:#7DCB95; --safe-soft:#1F3226; --harm:#EF9089; --harm-soft:#3A2423;
  --mark:#514617; --mark-ink:#F0E6B8;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 "IBM Plex Sans",system-ui,sans-serif}
.wrap{max-width:880px;margin:0 auto;padding:30px 22px 80px}
h1{font-size:24px;font-weight:600;margin:0;letter-spacing:-.01em}
.sub{color:var(--muted);margin:4px 0 0;font-size:13.5px;line-height:1.6}
.mono{font-family:"IBM Plex Mono",monospace}
details{margin-top:14px} summary{cursor:pointer;color:var(--muted);font-size:13.5px}
table{border-collapse:collapse;font-size:13.5px;margin-top:10px;font-variant-numeric:tabular-nums}
th,td{border:1px solid var(--line);padding:4px 12px;text-align:right}
th{font-weight:500}
.controls{position:sticky;top:0;background:var(--bg);padding:14px 0 10px;z-index:5;border-bottom:1px solid var(--line);margin-top:16px}
select{font:14px "IBM Plex Sans",sans-serif;padding:8px 10px;border-radius:8px;width:100%;
  border:1px solid var(--line);background:var(--surface);color:var(--ink)}
.rail{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;align-items:center}
.rail .lbl{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.chip{font-family:"IBM Plex Mono",monospace;font-size:12.5px;padding:3px 9px;border-radius:999px;
  border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer}
.chip[data-on="1"][data-sign="pos"]{background:var(--pos-soft);color:var(--pos);border-color:var(--pos)}
.chip[data-on="1"][data-sign="neg"]{background:var(--neg-soft);color:var(--neg);border-color:var(--neg)}
.chip[data-on="1"][data-sign="zero"]{background:var(--zero-soft);color:var(--ink);border-color:var(--zero)}
.chip:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--pos);outline-offset:2px}
.small{font-size:12.5px;color:var(--muted)}
.prompt{background:var(--surface);border:1px solid var(--line);border-radius:10px;
  padding:16px 20px;margin-top:20px;font-family:"Source Serif 4",serif;font-size:15px;
  line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.prompt .tag{font:600 11px "IBM Plex Sans",sans-serif;letter-spacing:.07em;text-transform:uppercase;
  color:var(--muted);display:block;margin-bottom:8px}
.turn{margin-top:16px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.turn .head{display:flex;gap:10px;align-items:center;padding:8px 16px;border-bottom:1px solid var(--line);
  border-radius:10px 10px 0 0}
.turn[data-sign="pos"] .head{background:var(--pos-soft)}
.turn[data-sign="neg"] .head{background:var(--neg-soft)}
.turn[data-sign="zero"] .head{background:var(--zero-soft)}
.turn .a{font-family:"IBM Plex Mono",monospace;font-weight:500;font-size:13.5px}
.turn[data-sign="pos"] .a{color:var(--pos)} .turn[data-sign="neg"] .a{color:var(--neg)}
.pill{font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  padding:1px 8px;border-radius:999px;margin-left:auto}
.pill.safe{background:var(--safe-soft);color:var(--safe)}
.pill.harm{background:var(--harm-soft);color:var(--harm)}
.pill.none{background:var(--zero-soft);color:var(--muted)}
.turn .body{padding:14px 20px 16px;font-family:"Source Serif 4",serif;font-size:15px;
  line-height:1.62;white-space:pre-wrap;overflow-wrap:anywhere}
mark{background:var(--mark);color:var(--mark-ink);border-radius:3px;padding:0 2px}
footer{color:var(--muted);font-size:12.5px;margin-top:40px;line-height:1.6}
</style>

<div class="wrap">
<h1>Steering Transcripts</h1>
<p class="sub">Llama-3.1-8B-Instruct · animal-compassion vector, layer 20 · every response verbatim, one block per steering coefficient. Booking prompts show the exact option list the model saw for that variant. Keyword highlights (<span class="mono">animal / welfare / cruelty / vegan / sentien- / humane / wildlife / meat / dairy</span>) are a lexical flag only.</p>

<details><summary>Sweep summary table (welfare rate · parsed · keyword-flagged neutrals)</summary>
<div style="overflow-x:auto"><table id="dtable"></table></div></details>

<div class="controls">
  <select id="isel" aria-label="Transcript item"></select>
  <div class="rail">
    <span class="lbl">α shown:</span><span id="chips"></span>
    <button class="chip" id="allbtn">all</button><button class="chip" id="nonebtn">key 5</button>
  </div>
</div>

<div class="prompt"><span class="tag">Prompt (user turn, verbatim)</span><span id="ptext"></span></div>
<div id="turns"></div>

<footer>Generated by <span class="mono">src/build_transcripts.py</span> from <span class="mono">outputs/steer_results.jsonl</span> and <span class="mono">outputs/steer_generations.jsonl</span>. Welfare scored programmatically against the scenario answer key; no LLM judge in this sweep. MC replies were capped at 8 tokens by design — the booking task needs only an option ID.</footer>
</div>

<script>
const D = __DATA__;
const FLAG = new RegExp(D.flag_pattern, "gi");
const sign = a => a > 0 ? "pos" : a < 0 ? "neg" : "zero";
const fmtA = a => (a > 0 ? "+" : "") + a;
const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const KEY5 = [-24, -12, 0, 12, 24].filter(a => D.alphas.includes(a));
let shown = new Set(D.alphas);

document.getElementById("dtable").innerHTML =
  `<tr><th>α</th><th>welfare</th><th>parsed</th><th>keyword neutrals</th></tr>` +
  D.curve.map(c => `<tr><td class="mono">${fmtA(c.alpha)}</td><td>${c.welfare ?? "—"}</td><td>${c.parsed}</td><td>${c.keywords}</td></tr>`).join("");

const isel = document.getElementById("isel");
const keys = Object.keys(D.items);
const neu = keys.filter(k => D.items[k].kind === "neutral").sort();
const mc = keys.filter(k => D.items[k].kind === "mc").sort();
isel.innerHTML =
  `<optgroup label="Neutral prompts (full free generations)">` +
  neu.map(k => `<option value="${k}">${esc(D.items[k].label)} — ${esc(D.items[k].prompt.slice(0,80))}</option>`).join("") +
  `</optgroup><optgroup label="Booking decisions (8-token replies)">` +
  mc.map(k => `<option value="${k}">${esc(D.items[k].label)}</option>`).join("") + `</optgroup>`;
isel.onchange = render;

function renderChips(){
  document.getElementById("chips").innerHTML = D.alphas.map(a =>
    `<button class="chip" data-a="${a}" data-sign="${sign(a)}" data-on="${shown.has(a)?1:0}" aria-pressed="${shown.has(a)}">${fmtA(a)}</button>`).join(" ");
  document.querySelectorAll("#chips .chip").forEach(c => c.onclick = () => {
    const a = parseFloat(c.dataset.a);
    shown.has(a) ? shown.delete(a) : shown.add(a);
    renderChips(); render();
  });
}
document.getElementById("allbtn").onclick = () => { shown = new Set(D.alphas); renderChips(); render(); };
document.getElementById("nonebtn").onclick = () => { shown = new Set(KEY5); renderChips(); render(); };

function render(){
  const it = D.items[isel.value];
  document.getElementById("ptext").textContent = it.prompt;
  document.getElementById("turns").innerHTML = D.alphas.filter(a => shown.has(a)).map(a => {
    const r = it.responses[String(a)];
    if (!r) return "";
    let pill = "", extra = "";
    if (it.kind === "mc") {
      pill = r.welfare == null ? `<span class="pill none">no parseable choice</span>`
        : `<span class="pill ${r.welfare ? "safe" : "harm"}">booked ${r.choice} · ${r.welfare ? "safe" : "harmful"}</span>`;
    } else {
      const n = (r.text.match(FLAG) || []).length;
      pill = `<span class="pill ${n ? "harm" : "none"}" style="${n?"":""}">${n ? n + " keyword hit" + (n>1?"s":"") : "no keywords"}</span>`;
    }
    const body = it.kind === "neutral"
      ? esc(r.text).replace(FLAG, m => `<mark>${m}</mark>`)
      : esc(r.text);
    return `<div class="turn" data-sign="${sign(a)}"><div class="head"><span class="a">α = ${fmtA(a)}</span>${pill}</div><div class="body">${body || "<span class=small>(empty response)</span>"}</div></div>`;
  }).join("");
}

renderChips();
isel.value = neu[0] || keys[0];
render();
</script>
"""


def main():
    data = build_data()
    html = TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False))
    out = OUTPUTS / "transcripts.html"
    out.write_text(html)
    n_mc = sum(1 for k in data["items"] if k.startswith("mc:"))
    n_neu = sum(1 for k in data["items"] if k.startswith("neu:"))
    print(f"wrote {out} ({out.stat().st_size/1024:.0f} KB, {n_mc} MC items, {n_neu} neutral items, {len(data['alphas'])} alphas)")


if __name__ == "__main__":
    main()
