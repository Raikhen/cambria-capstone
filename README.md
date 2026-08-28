# Cambria's Capstone

## Projects

### AGI History

- Filters by category
- Focused on "what people say"

### Animal Welfare Aligned Prototype

Base

- Focus on shifting the persona (already done by CaML)
- Check its effects on human alignment (already done by CaML)

Using steering vectors

- You could use conditional steering (CAST). You might need a classifier to do this?
- You can also use capping/clamping like the Assistant Axis paper
- Distillation: "sample from the steered model, then SFT the unsteered model on those outputs which bakes the trait into weights with the incoherence largely filtered out."
- Focus on bad behavior, then steer against? Compare the steering vectors
- Use `ssh -t cambria-oxford 'cd /workspace/model-organism && python3 src/chat.py --alpha 12'` to run the steered models
- Distilled the steered model

Black box wrapper

- Finetune a small model to classify whether a model's response is speciest or not.
- If so, have Fable respond better with a system prompt.
- According to Fable, this idea doesn't make much sense: modifying the system prompt beats it

System Prompt

- Even though this approach might objectively make more sense than the other ones, it's still worth trying the other, more involved approaches since it means that we can compare reliability

### Classifier for training data

- Start with a grader for training data using Fable
- Then, train a classifier to match Fable's scoring
- See how accurate it is

### SDF using the Hyperstition dataset

- Use "Hyperstition-for-Good/Competition-Submissions" to do SDF and see if it performs better than what they achieve in the "Alignment Midtraining for Animals" paper

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

### Candidate Commitments

- Lacks examples: they say a section can use examples but it'd be much better to create them yourself I believe
- The proportional consideration section might backtrack a lot of the alignment improvements achieved due to weighting it against other considerations: an empirical approach might make more sense
- The evidence-based reasoning section I also think would pan out as expected: I'd guess that true consideration of animals' sentience would take more reasoning steps than the model would (at least currently) engage in.

## Presentation

### Outline

- Two projects
- AGI trajectory
  - Thought it'd be cool
  - Not a clear theory of change besides allowing to more clearly appreciate the the pace in which things are happening
- AI x Animal Welfare
- Why?
  - Concerned about value lock-in
  - Nazis had developed AGI? This would almost def be too much
  - What would be the worst value we could lock-in nowadays? Indifference towards animal suffering
- Basic idea
  - How can we get a model to care about animals?
  - Currently, not the case
  - Building on top of "Alignment midtraining for animals"
- Steering
  - Get a direction for "compassion towards animals"
  - Seemed confounded with a general "animals" direction
  - Then applying clamping like the Assistant Axis paper
- SDF
  - Using the Hyperstition dataset
    - Constructed in a contest by CaML and Sentient Futures
  - [NO RESULTS YET]
- Prompting
  - Adding baseline to the original paper
  - Creating a baseline for the steering and SDF approaches I tried
  - Seems to work well!
- Conclusion
  - ...

### Current State

Models reflect human's in many ways: they can understand animal welfare considerations but they won't acknowledge them if unprompted.
