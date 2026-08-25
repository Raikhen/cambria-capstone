# Ideas

## Projects

### AGI History

- Filters by category
- Focused on "what people say"

### Model Organism

Base

- Focus on shifting the persona (already done by CaML)
- Check its effects on human alignment (already done by CaML)

Using steering vectors

- You could use conditional steering (CAST). You might need a classifier to do this?
- You can also use capping/clamping like the Assistant Axis paper
- Distillation: "sample from the steered model, then SFT the unsteered model on those outputs which bakes the trait into weights with the incoherence largely filtered out."

Black box wrapper

- Finetune a small model to classify whether a model's response is speciest or not.
- If so, have Fable respond better with a system prompt.

### Classifier for training data

- Start with a grader for training data using Fable
- Then, train a classifier to match Fable's scoring
- See how accurate it is

### Other thoughts

- You probably wanna do something that uses model's internals in order to practice what you've been learning during the program

### Hyperstition

- "Hyperstition-for-Good/Competition-Submissions"

## CaML papers

### Bullfight

- TAC is an agentic benchmark but limited to a booking a trip?

### Helpfulness hurts

- They try to measure how much alignment degrade during post-training after doing some mid-training alignment

### Alignment midtraining

- They literally check Paul's idea very directly!
- They claim that there was no reduction in capabilities...
- This paper precedes the hyperstition dataset so one could try using that dataset
- I don't quite understand if they are saying that they are also varying the system prompt...
- They use HellaSwag capabilities, which from what I understand is a pretty old capabilities benchmark: you should try a newer one
- It might honestly be a good idea to just do the same but with a bigger, newer model
- "The pre-post-training advantage erodes" <- Perhaps a persona change might be the way to tackle this. If you can fix a steered model, you could just try steering using a system prompt

### Assert, don't describe

- How to convince LLMs that animals matter?

### Small edits, large models

- Crazy stuff: they edit Wikipedia to be more pro-AW and they see a causal effect...
