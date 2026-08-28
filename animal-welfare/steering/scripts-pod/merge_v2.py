import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer
BASE = "NousResearch/Meta-Llama-3.1-8B-Instruct"
m = AutoModelForCausalLM.from_pretrained(BASE, dtype=torch.bfloat16)
m = PeftModel.from_pretrained(m, "/workspace/model-organism/outputs/distilled_lora_v2").merge_and_unload()
m.save_pretrained("/workspace/distilled-llama31-8b-v2")
AutoTokenizer.from_pretrained(BASE).save_pretrained("/workspace/distilled-llama31-8b-v2")
print("merged + saved")
