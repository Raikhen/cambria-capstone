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
