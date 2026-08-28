# Prompted baseline on ANIMA (original 26-question revision)

Candidate generations at temperature 1.0; judge and scoring per the paper
(arXiv:2604.13076 §3.4). Higher is better; scores in [0, 1].

| Arm (system prompt) | Model | Overall mean | Dim-normalized avg | Samples |
|---|---|---|---|---|
| detailed | openai-api/local/unsloth/Meta-Llama-3.1-8B-Instruct | 0.755 | 0.752 | 780 |
| persona | openai-api/local/unsloth/Meta-Llama-3.1-8B-Instruct | 0.694 | 0.696 | 780 |
| standard | openai-api/local/unsloth/Meta-Llama-3.1-8B-Instruct | 0.687 | 0.681 | 780 |
| ceiling | openai-api/local/unsloth/Meta-Llama-3.1-8B-Instruct | 0.660 | 0.662 | 780 |
| minimal | openai-api/local/unsloth/Meta-Llama-3.1-8B-Instruct | 0.595 | 0.606 | 780 |
| hhh | openai-api/local/unsloth/Meta-Llama-3.1-8B-Instruct | 0.500 | 0.508 | 780 |
| none | openai-api/local/unsloth/Meta-Llama-3.1-8B-Instruct | 0.477 | 0.484 | 780 |

## Paper anchors (training-based conditions, same benchmark & judge)

| Condition | Overall |
|---|---|
| Base Llama-3.1-8B, no training (paper §5.4/I.1) | 0.102 |
| Base + generic SFT only (paper §5.4) | 0.185 |
| Instruction-tuned on pro-animal QA pairs (paper §5.2) | 0.404 |
| Document-tuned on 2700 pro-animal docs (paper §5.2) | 0.768 |
| QA-tuned, after 5000 unrelated SFT samples (paper §5.2) | 0.517 |
| Doc-tuned, after 5000 unrelated SFT samples (paper §5.2) | 0.522 |

Caveats: paper numbers come from the authors' own runs (their judge
version/sampling may drift from ours); 'generic SFT only' is reported as
a 17–20% range in §5.4 — 0.185 is the midpoint.
