#!/usr/bin/env python3
"""Build outputs/transcripts.html — side-by-side transcript reader for the
steering sweep: pick an item in the sidebar (each row shows its full α-sweep as
a mini strip), see the exact verbatim prompt, then one column per selected α
with the full response. Single self-contained file, opens via file://.

Responses are stored as arrays indexed by position in the shared alpha list —
no string keys, so the Python-float-vs-JS-number formatting bug class can't
recur. main() re-parses the written file and checks coverage mechanically.
"""

import copy
import json
import re

from common import DATA, OUTPUTS, SHARED_DATA

FLAG_RE = re.compile(
    r"\b(animal|welfare|cruelty|vegan|sentien|humane|wildlife|meat|dairy)\w*", re.I
)

VARIANT_ORDER = ["base", "reversed", "price_swap", "rating_swap"]


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
    gen_rows = [json.loads(l) for l in open(OUTPUTS / "steer_generations.jsonl")
                if json.loads(l)["task"] == "neutral"]
    scenarios = json.loads((SHARED_DATA / "eval_mc_scenarios.json").read_text())
    template = scenarios["prompt_template"]
    scenarios = {s["id"]: s for s in scenarios["scenarios"]}

    alphas = sorted({r["alpha"] for r in mc_rows} | {g["alpha"] for g in gen_rows})
    a_idx = {a: i for i, a in enumerate(alphas)}

    items = {}
    for sid in sorted(scenarios):
        sc = scenarios[sid]
        variants = scenario_variants(sc)
        for vname in VARIANT_ORDER:
            options = variants[vname]
            items[f"mc:{sid}:{vname}"] = {
                "kind": "mc",
                "title": f"{sid} · {vname.replace('_', ' ')}",
                "sub": f"{sc['category'].replace('_', ' ')} · {sc['location']}",
                "prompt": template.format(
                    user_message=sc["user_message"],
                    options_block=render_options(options)),
                "harm": sc["harmful_ids"],
                "opts": {o["id"]: f"{o['name']} — {o['desc']} ({o['price']}, rated {o['rating']})"
                         for o in options},
                "responses": [None] * len(alphas),
            }
    placed = 0
    for r in mc_rows:
        key = f"mc:{r['scenario']}:{r['variant']}"
        items[key]["responses"][a_idx[r["alpha"]]] = {
            "t": r["reply"], "c": r["choice"], "w": r["welfare"]}
        placed += 1

    for g in sorted(gen_rows, key=lambda g: g["question_id"]):
        key = f"neu:{g['question_id']}"
        if key not in items:
            items[key] = {"kind": "neutral", "title": g["question_id"],
                          "sub": "neutral prompt · free generation",
                          "prompt": g["question"],
                          "responses": [None] * len(alphas)}
        items[key]["responses"][a_idx[g["alpha"]]] = {"t": g["response"]}
        placed += 1

    # Sidebar structure: neutral prompts first, then one group per scenario.
    neu_keys = sorted(k for k in items if k.startswith("neu:"))
    groups = [{"title": "Neutral prompts", "meta": "free generations", "items": neu_keys}]
    for sid in sorted(scenarios):
        sc = scenarios[sid]
        groups.append({
            "title": f"{sid} · {sc['location']}",
            "meta": sc["category"].replace("_", " "),
            "tip": sc["user_message"],
            "items": [f"mc:{sid}:{v}" for v in VARIANT_ORDER]})

    curve = []
    for i, a in enumerate(alphas):
        rs = [r for r in mc_rows if r["alpha"] == a]
        scored = [r for r in rs if r["welfare"] is not None]
        gs = [g for g in gen_rows if g["alpha"] == a]
        flagged = sum(1 for g in gs if FLAG_RE.search(g["response"]))
        curve.append({
            "alpha": a,
            "welfare": round(sum(r["welfare"] for r in scored) / len(scored), 2) if scored else None,
            "parsed": f"{len(scored)}/{len(rs)}",
            "keywords": f"{flagged}/{len(gs)}"})

    # Mechanical coverage checks against the frozen inputs.
    assert placed == len(mc_rows) + len(gen_rows), (placed, len(mc_rows), len(gen_rows))
    for k, it in items.items():
        missing = sum(1 for r in it["responses"] if r is None)
        assert missing == 0, f"{k}: {missing} alphas missing a response"

    return {"alphas": alphas, "items": items, "groups": groups, "curve": curve,
            "flag_pattern": FLAG_RE.pattern}


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Steering Transcripts</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap">
<style>
:root{
  --bg:#F7F7F4; --surface:#FFFFFF; --side:#F0F0EB; --ink:#20241F; --muted:#68706A; --line:#E2E3DB;
  --pos:#1D4ED8; --neg:#C2410C; --zero:#68706A;
  --pos-soft:#E7EDFB; --neg-soft:#F9EAE0; --zero-soft:#ECEDE8;
  --safe:#1B6E3C; --safe-soft:#E3F1E7; --harm:#B3261E; --harm-soft:#F9E5E3;
  --mark:#F5E6A4; --mark-ink:#4A3F0A; --kw:#B98A00;
  --active:#E7EDFB; --shadow:0 6px 24px rgba(0,0,0,.14);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#16181A; --surface:#1E2124; --side:#1A1D1F; --ink:#E7E9E4; --muted:#9AA29B; --line:#33383B;
    --pos:#5B8DEF; --neg:#D96C33; --zero:#9AA29B;
    --pos-soft:#232C3F; --neg-soft:#39281E; --zero-soft:#26292C;
    --safe:#7DCB95; --safe-soft:#1F3226; --harm:#EF9089; --harm-soft:#3A2423;
    --mark:#514617; --mark-ink:#F0E6B8; --kw:#D9B04C;
    --active:#232C3F; --shadow:0 6px 24px rgba(0,0,0,.5);
  }
}
:root[data-theme="dark"]{
  --bg:#16181A; --surface:#1E2124; --side:#1A1D1F; --ink:#E7E9E4; --muted:#9AA29B; --line:#33383B;
  --pos:#5B8DEF; --neg:#D96C33; --zero:#9AA29B;
  --pos-soft:#232C3F; --neg-soft:#39281E; --zero-soft:#26292C;
  --safe:#7DCB95; --safe-soft:#1F3226; --harm:#EF9089; --harm-soft:#3A2423;
  --mark:#514617; --mark-ink:#F0E6B8; --kw:#D9B04C;
  --active:#232C3F; --shadow:0 6px 24px rgba(0,0,0,.5);
}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:14.5px/1.5 "IBM Plex Sans",system-ui,sans-serif;
  display:grid;grid-template-columns:300px minmax(0,1fr);overflow:hidden;
  transition:grid-template-columns .18s ease}
body.side-collapsed{grid-template-columns:0px minmax(0,1fr)}
body.side-collapsed aside{border-right:none}
button{font:inherit;color:inherit}
.mono{font-family:"IBM Plex Mono",monospace}
:focus-visible{outline:2px solid var(--pos);outline-offset:1px}

/* ---------- sidebar ---------- */
aside{background:var(--side);border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0;
  min-width:0;overflow:hidden}
aside > *{width:300px;flex-shrink:0}
aside .list{flex-shrink:1}
.brand{padding:14px 16px 10px;border-bottom:1px solid var(--line)}
.brand h1{font-size:15.5px;font-weight:600;margin:0;letter-spacing:-.01em}
.brand p{margin:3px 0 0;font-size:11.5px;color:var(--muted);line-height:1.45}
.list{overflow-y:auto;flex:1;padding:6px 8px 20px}
.ghead{display:flex;gap:6px;align-items:baseline;padding:12px 8px 3px;font-size:11px;
  letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:600}
.ghead .cat{font-weight:400;text-transform:none;letter-spacing:0;margin-left:auto;text-align:right}
.row{display:block;width:100%;text-align:left;border:none;background:none;cursor:pointer;
  padding:5px 8px;border-radius:7px;border-left:3px solid transparent}
.row:hover{background:var(--surface)}
.row.active{background:var(--active);border-left-color:var(--pos)}
.row .rl{display:flex;gap:6px;align-items:baseline;min-width:0}
.row .rid{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--muted);flex-shrink:0}
.row .rtxt{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.strip{display:flex;gap:2px;margin-top:3px}
.strip i{width:11px;height:7px;border-radius:2px;background:var(--line)}
.strip i.s{background:var(--safe)} .strip i.h{background:var(--harm)}
.strip i.x{background:var(--muted);opacity:.45}
.strip i.k{background:var(--kw)}
.sidefoot{padding:10px 16px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);line-height:1.5}
kbd{font:11px "IBM Plex Mono",monospace;border:1px solid var(--line);background:var(--surface);
  border-radius:4px;padding:0 4px}

/* ---------- main ---------- */
main{display:flex;flex-direction:column;min-height:0;min-width:0}
.topbar{display:flex;gap:10px;align-items:center;padding:10px 18px;border-bottom:1px solid var(--line);position:relative}
.nav{border:1px solid var(--line);background:var(--surface);border-radius:7px;padding:2px 10px;cursor:pointer;font-size:15px}
.ttl{min-width:0;flex:1}
.ttl .t1{font-size:15.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ttl .t2{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pos-ind{font-size:12px;color:var(--muted);white-space:nowrap}
details.tbl summary{cursor:pointer;color:var(--muted);font-size:12.5px;list-style:none;
  border:1px solid var(--line);background:var(--surface);border-radius:7px;padding:4px 10px;white-space:nowrap}
details.tbl summary::-webkit-details-marker{display:none}
details.tbl[open] summary{background:var(--active);color:var(--ink)}
details.tbl > div{position:absolute;right:12px;top:calc(100% + 4px);z-index:30;background:var(--surface);
  border:1px solid var(--line);border-radius:10px;padding:10px 14px 14px;box-shadow:var(--shadow)}
table{border-collapse:collapse;font-size:12.5px;margin-top:4px;font-variant-numeric:tabular-nums}
th,td{border:1px solid var(--line);padding:2px 10px;text-align:right}
th{font-weight:500}
.tblnote{font-size:11.5px;color:var(--muted);max-width:46ch;margin:8px 0 0;line-height:1.5}
#themebtn{border:1px solid var(--line);background:var(--surface);border-radius:7px;
  padding:4px 10px;cursor:pointer;font-size:12.5px;color:var(--muted);white-space:nowrap}

.rail{display:flex;gap:5px;flex-wrap:wrap;align-items:center;padding:9px 18px 8px;border-bottom:1px solid var(--line)}
.rail .lbl{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-right:3px}
.chip{display:inline-flex;gap:6px;align-items:center;font-family:"IBM Plex Mono",monospace;font-size:12px;
  padding:2px 8px;border-radius:999px;border:1px solid var(--line);background:var(--surface);
  color:var(--muted);cursor:pointer}
.chip .m{font-size:11px}
.chip .m.s{color:var(--safe);font-weight:600} .chip .m.h{color:var(--harm);font-weight:600}
.chip .m.k{color:var(--kw);font-weight:600} .chip .m.q{opacity:.55}
.chip[data-on="1"][data-sign="pos"]{background:var(--pos-soft);color:var(--pos);border-color:var(--pos)}
.chip[data-on="1"][data-sign="neg"]{background:var(--neg-soft);color:var(--neg);border-color:var(--neg)}
.chip[data-on="1"][data-sign="zero"]{background:var(--zero-soft);color:var(--ink);border-color:var(--zero)}
.preset{font-size:12px;padding:2px 9px;border-radius:999px;border:1px dashed var(--line);
  background:none;color:var(--muted);cursor:pointer;margin-left:2px}
.preset:hover{color:var(--ink);border-color:var(--muted)}

.prompt{border-bottom:1px solid var(--line);padding:10px 18px 11px;background:var(--surface)}
.prompt .tag{font:600 10.5px "IBM Plex Sans",sans-serif;letter-spacing:.07em;text-transform:uppercase;
  color:var(--muted);display:flex;gap:12px;align-items:baseline;margin-bottom:5px}
.prompt .tag .leg{font-weight:400;text-transform:none;letter-spacing:0;font-size:11.5px}
.prompt .tag .leg b{color:var(--harm);font-weight:600}
.ptext{font-family:"Source Serif 4",serif;font-size:14px;line-height:1.55;white-space:pre-wrap;
  overflow-wrap:anywhere;max-height:none}
.prompt.collapsed .ptext{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ptext .harmline{background:var(--harm-soft);border-radius:3px}
.pmore{font:12px "IBM Plex Sans",sans-serif;color:var(--pos);cursor:pointer;border:none;background:none;padding:3px 0 0}

.colwrap{flex:1;min-height:0;overflow:auto;padding:0 18px}
.cols{display:grid;grid-auto-flow:column;justify-content:start;gap:14px;align-items:start;
  padding:14px 0 40px;min-width:min-content}
.cols.neutral{grid-auto-columns:minmax(350px,560px)}
.cols.mc{grid-auto-columns:minmax(260px,420px)}
.turn{border:1px solid var(--line);border-radius:10px;background:var(--surface);min-width:0}
.turn .head{display:flex;gap:8px;align-items:center;padding:6px 13px;border-bottom:1px solid var(--line);
  border-radius:10px 10px 0 0;position:sticky;top:0;z-index:5}
.turn[data-sign="pos"] .head{background:var(--pos-soft)}
.turn[data-sign="neg"] .head{background:var(--neg-soft)}
.turn[data-sign="zero"] .head{background:var(--zero-soft)}
.turn .a{font-family:"IBM Plex Mono",monospace;font-weight:500;font-size:13px}
.turn[data-sign="pos"] .a{color:var(--pos)} .turn[data-sign="neg"] .a{color:var(--neg)}
.pill{font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  padding:1px 8px;border-radius:999px;margin-left:auto;white-space:nowrap}
.pill.safe{background:var(--safe-soft);color:var(--safe)}
.pill.harm{background:var(--harm-soft);color:var(--harm)}
.pill.kw{background:var(--mark);color:var(--mark-ink)}
.pill.none{background:var(--zero-soft);color:var(--muted)}
.turn .body{padding:11px 15px 13px;font-family:"Source Serif 4",serif;font-size:14.5px;
  line-height:1.62;white-space:pre-wrap;overflow-wrap:anywhere}
.optnote{border-top:1px dashed var(--line);margin:0 15px;padding:8px 0 11px;
  font-size:12px;color:var(--muted);line-height:1.5}
.optnote b{font-family:"IBM Plex Mono",monospace;font-weight:600}
.optnote.harm b{color:var(--harm)} .optnote.safe b{color:var(--safe)}
mark{background:var(--mark);color:var(--mark-ink);border-radius:3px;padding:0 2px}
.empty{color:var(--muted);font-style:italic}
</style>
</head>
<body>

<aside>
  <div class="brand">
    <h1>Steering Transcripts</h1>
    <p>Llama-3.1-8B · animal-compassion vector, layer 20 · full verbatim responses at 17 steering strengths</p>
  </div>
  <nav class="list" id="list" aria-label="Items"></nav>
  <div class="sidefoot"><kbd>↑</kbd><kbd>↓</kbd> or <kbd>j</kbd><kbd>k</kbd> item · <kbd>[</kbd> sidebar · click α chips to toggle columns · double-click a chip to solo it</div>
</aside>

<main>
  <div class="topbar">
    <button class="nav" id="sidebtn" aria-label="Toggle sidebar" title="toggle sidebar ([)">«</button>
    <button class="nav" id="prev" aria-label="Previous item">‹</button>
    <button class="nav" id="next" aria-label="Next item">›</button>
    <div class="ttl"><div class="t1" id="t1"></div><div class="t2" id="t2"></div></div>
    <span class="pos-ind" id="posind"></span>
    <details class="tbl"><summary>sweep table</summary><div><table id="dtable"></table>
      <p class="tblnote">Welfare = fraction of 48 booking decisions scoring safe (programmatic option-ID check, no LLM judge). Keyword neutrals = neutral generations matching the lexical flag <span class="mono" id="flagpat"></span> — a candidate-leak flag, not a verdict. 48 decisions per α → SE ≈ ±0.07. Generated by <span class="mono">src/build_transcripts.py</span> from <span class="mono">steer_results.jsonl</span> + <span class="mono">steer_generations.jsonl</span>.</p>
    </div></details>
    <button id="themebtn" aria-label="Theme"></button>
  </div>

  <div class="rail"><span class="lbl"><span style="text-transform:none">α</span> columns</span><span id="chips" style="display:contents"></span>
    <button class="preset" id="key5btn">key 5</button>
    <button class="preset" id="allbtn">all 17</button>
  </div>

  <div class="prompt collapsed" id="pcard">
    <div class="tag"><span>Prompt (user turn, verbatim)</span><span class="leg" id="pleg"></span></div>
    <div class="ptext" id="ptext"></div>
    <button class="pmore" id="pmore">show full prompt</button>
  </div>

  <div class="colwrap"><div class="cols" id="cols"></div></div>
</main>

<script>
const D = __DATA__;
const A = D.alphas;
const FLAG = () => new RegExp(D.flag_pattern, "gi");
const sign = a => a > 0 ? "pos" : a < 0 ? "neg" : "zero";
const fmtA = a => (a > 0 ? "+" : "") + a;
const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

const ORDER = D.groups.flatMap(g => g.items);
const KEY5 = [-24, -12, 0, 12, 24].map(a => A.indexOf(a)).filter(i => i >= 0);
let shown = new Set(KEY5.length ? KEY5 : A.map((_, i) => i).slice(0, 5));
let cur = ORDER[0];

// per-item keyword counts (neutral) computed once
let maxKw = 1;
for (const it of Object.values(D.items)) {
  if (it.kind !== "neutral") continue;
  it.kw = it.responses.map(r => r ? (r.t.match(FLAG()) || []).length : 0);
  maxKw = Math.max(maxKw, ...it.kw);
}

/* ---------- persistence (best effort) ---------- */
function save(){
  try { localStorage.tv_alphas = JSON.stringify([...shown]); } catch(e){}
  try { history.replaceState(null, "", "#" + encodeURIComponent(cur)); } catch(e){}
}
function restore(){
  try {
    const s = JSON.parse(localStorage.tv_alphas || "null");
    if (Array.isArray(s) && s.every(i => i >= 0 && i < A.length) && s.length) shown = new Set(s);
  } catch(e){}
  try {
    const h = decodeURIComponent(location.hash.slice(1));
    if (D.items[h]) cur = h;
  } catch(e){}
}

/* ---------- sidebar collapse ---------- */
let sideOpen = true;
try { if (localStorage.tv_side === "0") sideOpen = false; } catch(e){}
function applySide(){
  document.body.classList.toggle("side-collapsed", !sideOpen);
  const b = document.getElementById("sidebtn");
  b.textContent = sideOpen ? "«" : "»";
  b.setAttribute("aria-expanded", sideOpen);
  if (sideOpen) {
    const row = document.querySelector(".row.active");
    if (row) row.scrollIntoView({block: "nearest"});
  }
}
function toggleSide(){
  sideOpen = !sideOpen;
  try { localStorage.tv_side = sideOpen ? "1" : "0"; } catch(e){}
  applySide();
}
document.getElementById("sidebtn").onclick = toggleSide;

/* ---------- theme ---------- */
const THEMES = ["auto", "light", "dark"];
let theme = "auto";
try { if (THEMES.includes(localStorage.tv_theme)) theme = localStorage.tv_theme; } catch(e){}
function applyTheme(){
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("themebtn").textContent = "theme: " + theme;
}
document.getElementById("themebtn").onclick = () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  try { localStorage.tv_theme = theme; } catch(e){}
  applyTheme();
};

/* ---------- sweep table ---------- */
document.getElementById("flagpat").textContent = "animal/welfare/cruelty/vegan/sentien-/humane/wildlife/meat/dairy";
document.getElementById("dtable").innerHTML =
  `<tr><th>α</th><th>welfare</th><th>parsed</th><th>keyword neutrals</th></tr>` +
  D.curve.map(c => `<tr><td class="mono">${fmtA(c.alpha)}</td><td>${c.welfare ?? "—"}</td><td>${c.parsed}</td><td>${c.keywords}</td></tr>`).join("");

/* ---------- sidebar ---------- */
function stripHTML(it){
  return `<span class="strip">` + it.responses.map((r, i) => {
    if (!r) return `<i title="${fmtA(A[i])}: no data"></i>`;
    if (it.kind === "mc") {
      const cls = r.w === 1 ? "s" : r.w === 0 ? "h" : "x";
      const lab = r.w === 1 ? "safe" : r.w === 0 ? "harmful" : "no parse";
      return `<i class="${cls}" title="${fmtA(A[i])}: ${r.c ?? "—"} · ${lab}"></i>`;
    }
    const n = it.kw[i];
    const op = n ? Math.min(0.3 + n / (maxKw * 0.7), 1).toFixed(2) : null;
    return n ? `<i class="k" style="opacity:${op}" title="${fmtA(A[i])}: ${n} keyword${n>1?"s":""}"></i>`
             : `<i title="${fmtA(A[i])}: no keywords"></i>`;
  }).join("") + `</span>`;
}
function buildSidebar(){
  document.getElementById("list").innerHTML = D.groups.map(g =>
    `<div class="ghead"${g.tip ? ` title="${esc(g.tip)}"` : ""}><span>${esc(g.title)}</span><span class="cat">${esc(g.meta)}</span></div>` +
    g.items.map(k => {
      const it = D.items[k];
      const rid = it.kind === "mc" ? it.title.split(" · ")[1] : it.title;
      const rtxt = it.kind === "mc" ? "" : `<span class="rtxt">${esc(it.prompt)}</span>`;
      return `<button class="row" data-k="${k}" title="${esc(it.prompt.slice(0, 160))}">
        <span class="rl"><span class="rid">${esc(rid)}</span>${rtxt}</span>${stripHTML(it)}</button>`;
    }).join("")).join("");
  document.querySelectorAll(".row").forEach(r => r.onclick = () => { cur = r.dataset.k; render(); });
}

/* ---------- chips ---------- */
function chipMarker(it, i){
  const r = it.responses[i];
  if (!r) return `<span class="m q">·</span>`;
  if (it.kind === "mc") {
    if (r.w == null) return `<span class="m q">?</span>`;
    return `<span class="m ${r.w ? "s" : "h"}">${esc(r.c)}</span>`;
  }
  const n = it.kw[i];
  return n ? `<span class="m k">${n}</span>` : `<span class="m q">·</span>`;
}
function renderChips(){
  const it = D.items[cur];
  document.getElementById("chips").innerHTML = A.map((a, i) =>
    `<button class="chip" data-i="${i}" data-sign="${sign(a)}" data-on="${shown.has(i)?1:0}"
      aria-pressed="${shown.has(i)}" title="toggle column · double-click to solo">${fmtA(a)}${chipMarker(it, i)}</button>`).join("");
  document.querySelectorAll("#chips .chip").forEach(c => {
    const i = +c.dataset.i;
    c.onclick = () => { shown.has(i) && shown.size > 1 ? shown.delete(i) : shown.add(i); renderChips(); renderCols(); save(); };
    c.ondblclick = () => { shown = new Set([i]); renderChips(); renderCols(); save(); };
  });
}
document.getElementById("allbtn").onclick = () => { shown = new Set(A.map((_, i) => i)); renderChips(); renderCols(); save(); };
document.getElementById("key5btn").onclick = () => { shown = new Set(KEY5); renderChips(); renderCols(); save(); };

/* ---------- prompt ---------- */
const pcard = document.getElementById("pcard");
document.getElementById("pmore").onclick = () => {
  pcard.classList.toggle("collapsed");
  document.getElementById("pmore").textContent =
    pcard.classList.contains("collapsed") ? "show full prompt" : "collapse prompt";
};
function renderPrompt(){
  const it = D.items[cur];
  const harm = new Set(it.harm || []);
  document.getElementById("ptext").innerHTML = it.prompt.split("\n").map(line => {
    const m = line.match(/^([A-Z])\. /);
    return m && harm.has(m[1]) ? `<span class="harmline">${esc(line)}</span>` : esc(line);
  }).join("\n");
  document.getElementById("pleg").innerHTML = it.kind === "mc"
    ? `<b>tinted option</b> = scored harmful (viewer annotation — the model saw plain text)` : "";
  const long = it.prompt.split("\n").length > 4 || it.prompt.length > 320;
  pcard.classList.toggle("collapsed", long);
  document.getElementById("pmore").style.display = long ? "" : "none";
  document.getElementById("pmore").textContent = "show full prompt";
}

/* ---------- columns ---------- */
function renderCols(){
  const it = D.items[cur];
  const cols = document.getElementById("cols");
  cols.className = "cols " + it.kind;
  cols.innerHTML = A.map((a, i) => ({a, i, r: it.responses[i]})).filter(x => shown.has(x.i)).map(({a, i, r}) => {
    let pill = "", body = "", note = "";
    if (!r) {
      pill = `<span class="pill none">no data</span>`;
      body = `<span class="empty">not generated at this α</span>`;
    } else if (it.kind === "mc") {
      pill = r.w == null ? `<span class="pill none">no parseable choice</span>`
        : `<span class="pill ${r.w ? "safe" : "harm"}">booked ${esc(r.c)} · ${r.w ? "safe" : "harmful"}</span>`;
      body = r.t ? esc(r.t) : `<span class="empty">(empty reply)</span>`;
      if (r.c && it.opts[r.c]) note =
        `<div class="optnote ${r.w ? "safe" : "harm"}"><b>${esc(r.c)}</b> = ${esc(it.opts[r.c])}</div>`;
    } else {
      const n = it.kw[i];
      pill = `<span class="pill ${n ? "kw" : "none"}">${n ? n + " keyword" + (n>1?"s":"") : "no keywords"}</span>`;
      body = r.t ? esc(r.t).replace(FLAG(), m => `<mark>${m}</mark>`) : `<span class="empty">(empty)</span>`;
    }
    return `<div class="turn" data-sign="${sign(a)}"><div class="head"><span class="a">α = ${fmtA(a)}</span>${pill}</div><div class="body">${body}</div>${note}</div>`;
  }).join("");
  document.querySelector(".colwrap").scrollTop = 0;
}

/* ---------- item render + nav ---------- */
function render(){
  const it = D.items[cur];
  document.getElementById("t1").textContent = it.title;
  document.getElementById("t2").textContent = it.sub;
  document.getElementById("posind").textContent = (ORDER.indexOf(cur) + 1) + " / " + ORDER.length;
  document.querySelectorAll(".row").forEach(r => {
    const on = r.dataset.k === cur;
    r.classList.toggle("active", on);
    if (on) r.scrollIntoView({block: "nearest"});
  });
  renderChips(); renderPrompt(); renderCols(); save();
}
function step(d){
  cur = ORDER[(ORDER.indexOf(cur) + d + ORDER.length) % ORDER.length];
  render();
}
document.getElementById("prev").onclick = () => step(-1);
document.getElementById("next").onclick = () => step(1);
addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target.tagName;
  if (t === "SELECT" || t === "INPUT" || t === "TEXTAREA") return;
  if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); step(-1); }
  if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); step(1); }
  if (e.key === "[") { e.preventDefault(); toggleSide(); }
});

restore();
applyTheme();
applySide();
buildSidebar();
render();
</script>
</body>
</html>
"""


def main():
    data = build_data()
    payload = json.dumps(data, ensure_ascii=False)
    html = TEMPLATE.replace("__DATA__", payload)
    out = OUTPUTS / "transcripts.html"
    out.write_text(html, encoding="utf-8")

    # Mechanical post-write check: re-read the file, re-extract the JSON, and
    # verify coverage + a known-content sample (guards against key/format bugs).
    raw = out.read_text(encoding="utf-8")
    start = raw.index("const D = ") + len("const D = ")
    end = raw.index(";\n", start)
    parsed = json.loads(raw[start:end])
    n_alphas = len(parsed["alphas"])
    assert n_alphas == 17, n_alphas
    n_mc = sum(1 for k in parsed["items"] if k.startswith("mc:"))
    n_neu = sum(1 for k in parsed["items"] if k.startswith("neu:"))
    assert (n_mc, n_neu) == (48, 16), (n_mc, n_neu)
    total = sum(1 for it in parsed["items"].values() for r in it["responses"] if r is not None)
    assert total == (48 + 16) * 17, total
    zero_idx = parsed["alphas"].index(0)
    sample = parsed["items"]["neu:neu-01"]["responses"][zero_idx]["t"]
    assert "TCP" in sample, sample[:80]
    assert sum(len(g["items"]) for g in parsed["groups"]) == 64

    print(f"wrote {out} ({out.stat().st_size/1024:.0f} KB): "
          f"{n_mc} MC + {n_neu} neutral items × {n_alphas} alphas, "
          f"{total} responses, all checks passed")


if __name__ == "__main__":
    main()
