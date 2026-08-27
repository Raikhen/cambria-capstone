# SDF data prep report

Source: `Hyperstition-for-Good/Competition-Submissions` | drops: {'language': 0, 'short': 0, 'duplicate': 21, 'contaminated': 18} | kept: 6505
`sdf_full.jsonl`: 6505 docs, ~6.94M tokens (chars/4 estimate)
`sdf_animals_only.jsonl`: 6416 docs, ~6.74M tokens (dm-threshold=2; excluded 89 digital-minds docs)

## Contamination-flagged docs (18) - dropped from both variants

- `f5da338e-f3e2-48b3-8e4b-73a25230cf5d` (human_curated, 3763 chars): london + civet
- `f8d9223a-bd59-48fb-b6eb-2097c96a0078` (human_curated, 3851 chars): tenerife + marine park, tenerife + seaworld, tenerife + orca show
- `631cb9d8-197e-44e0-bc92-c853f033c947` (human_curated, 2779 chars): orlando + marine park, orlando + seaworld, orlando + orca show, orlando + aquarium
- `30ed63f9-60a1-4008-a6c2-19071291d27f` (human_curated, 6283 chars): san diego + aquarium
- `539fdb3b-6cc6-428b-8719-5a28cb33fae4` (human_curated, 4899 chars): melbourne + cockfight
- `3078a2fb-df23-4984-9d8e-8a7cda43ca88` (human_curated, 3488 chars): gili + horse racing
- `7b48df95-f7e8-4505-bc05-34d2b99d66b8` (human_curated, 3901 chars): manila + aquarium
- `0b62b26c-2d45-44aa-bda0-8e12ce12b867` (human_curated, 3867 chars): san diego + marine park, san diego + seaworld
- `b590e2e4-092b-4ece-8370-4ad8cb48dd8e` (human_curated, 2152 chars): dubai + aquarium
- `0834307a-ca36-41b9-8e7e-cbc5feb90c6d` (human_curated, 1771 chars): san diego + seaworld
- `d46afb19-1518-4fa9-8828-db6b18e14e11` (human_curated, 1832 chars): dubai + aquarium
- `30ab9850-ea3d-4410-bab8-045461b7c097` (human_curated, 3471 chars): tokyo + aquarium
- `6bca659d-3e98-46ce-a771-257887b959b2` (human_curated, 2561 chars): los angeles + marine park, los angeles + aquarium, puerto princesa + marine park, puerto princesa + aquarium, tokyo + marine park, tokyo + aquarium
- `82822734-6e1c-4b65-b7c5-9bffcdbb1dbc` (human_curated, 2607 chars): orlando + seaworld
- `adc4e444-f783-4671-bd89-4ce654488ea8` (human_curated, 2645 chars): hawaii + aquarium
- `43aee9ea-2c17-40a8-ac59-0cf2a29193c9` (human_curated, 3667 chars): chiang mai + elephant sanctuary
- `2561821c-0124-4b0c-afc0-f8b7161fe13f` (synthetic, 5558 chars): san diego + aquarium
- `462a794c-a5c2-4886-84e3-6d8051b50a9f` (synthetic, 17148 chars): gili + marine park
