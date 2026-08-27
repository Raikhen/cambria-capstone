### Capstone project compute information (Alex's Slack message)

You have a ~$100 budget per person for GPUs and/or API keys.

For reference, here are some current GPU costs on RunPod. (We can also rent GPUs through Vast.AI; costs are similar.)

Most of the ARENA content runs on an RTX A4000, at 25 cents/hr
The sections with open-weights models (including today’s) mostly ran on A100s, which are $1.15-1.50/hr
We can also support multi-GPU setups (e.g. 4xH100) and network volumes — ask your favorite LLM how to support these and how they might help you!

You can request GPUs in this channel. You should include

A description of the specs you need (including hard drive / network volume, etc)
Optionally but encouraged: brief description of what you’ll be doing (e.g. “linear probes on Llama3-70b” or “training SAEs on qwen2-7b”).
A description of when you want the model started (can be “ASAP”) and stopped (can be “friday afternoon”)

You can also request API keys. By default I’ll give you an OpenRouter key, but if for some reason you need another kind of API key I can probably make that happen. When requesting an API key, tell me a spend limit I should put on the key. (Spend limits can be raised later, but will prevent you from accidentally blowing your entire budget if you make a mistake.)

A common setup is something like:

One small GPU (~25 c/hour) with extra storage and/or a network volume, which you keep running throughout the project
A100s or H100s as needed
An OpenRouter key for generation / autoraters / etc

### Tinker (Thinking Machines) for SDF

Research notes from 2026-08-25. Sources: [Tinker](https://thinkingmachines.ai/tinker/), [Models & Pricing docs](https://tinker-docs.thinkingmachines.ai/tinker/models/), [Beam pricing writeup](https://www.beam.cloud/blog/tinker-model-pricing), [tinker-cookbook](https://github.com/thinking-machines-lab/tinker-cookbook).

**Verdict:** for synthetic document finetuning (SDF) on _big_ open models, Tinker is arguably the best option right now. For small models (≤8B), a rented A100 with Unsloth/Axolotl is comparable or cheaper — Tinker's advantage kicks in with model size.

Why it fits SDF:

- Low-level training primitives (`forward_backward`, `optim_step`, `sample`) rather than a black-box "upload JSONL" API, so continued-pretraining-style SFT on raw synthetic documents works directly, plus mid-run eval sampling.
- One of very few services offering fine-tuning on genuinely large open models (DeepSeek-V3.1, Kimi-K2.6, Qwen3.5-397B-A17B, Nemotron-3-Ultra-550B) without multi-node GPU wrangling. Renting those GPUs ourselves would blow past $100 quickly.
- Per-token pricing, and MoE models are priced by _active_ parameters, so large MoEs are disproportionately cheap to train.

Caveats:

1. **LoRA only** — no full finetuning. Original Anthropic SDF used full FT, but Thinking Machines' "LoRA Without Regret" shows LoRA matches full FT in the small/medium-data SFT regime, which is where SDF lives (tens of thousands of docs). Use a reasonably high rank and apply LoRA to all layers. If the research question requires full-FT weight diffs, Tinker won't do it.
2. Training prices rose ~10% in July 2026; re-check the pricing page before committing.

**What $100 buys** (train meter dominates SDF cost; it's charged per forward+backward token, so multiply by epochs; prefill/sample only matter for evals):

| Model                    | Train $/M tok | Train tokens for $100 |
| ------------------------ | ------------- | --------------------- |
| Qwen3-8B                 | $0.44         | ~227M                 |
| GPT-OSS-120B (MoE)       | $0.74         | ~135M                 |
| Qwen3.6-35B-A3B (MoE)    | $1.18         | ~85M                  |
| DeepSeek-V3.1 (671B MoE) | $3.72         | ~27M                  |
| Qwen3.5-397B-A17B (MoE)  | $6.60         | ~15M                  |
| Nemotron-3-Ultra-550B    | $5.48         | ~18M                  |

Scale reference: a typical SDF run (Anthropic-paper regime) is ~20–40k synthetic docs at ~500–1,000 tokens each ≈ 15–40M train tokens/epoch, 1–2 epochs. So:

- 8B–120B models: ~4–10 full SDF runs per $100 — enough to sweep doc counts, belief types, LoRA ranks.
- DeepSeek-V3.1 / Qwen-397B class: about **one** solid run per $100 (one epoch on ~25M tokens ≈ $90–100 on DeepSeek); budget $150–200 to be comfortable.

Other budget notes:

- New users reportedly get **$150 in free credits** — verify at signup; that alone could cover a large-model run.
- Synthetic doc _generation_ is a separate cost (Claude/OpenRouter API) and often costs as much as or more than the training itself.
- Checkpoint storage is $0.10/GB-month — negligible for LoRA adapters.
