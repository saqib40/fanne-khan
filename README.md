# Fanne Khan

A fully local prompt-to-kinetic-typography system for short motion-design
videos. The model-facing contract is structured JSON; only trusted Remotion
components execute.

## Why the structured contract

The model will choose copy hierarchy, layout, palette, timing, transitions, and
optional 3D accents through a bounded `MotionSpec`. It will not generate React
or JavaScript. This gives the project:

- deterministic rendering and offline export;
- schema-level rejection of unknown or unsafe behavior;
- reusable motion primitives with consistent quality;
- measurable typography and timing decisions;
- compact outputs suitable for a local 7B model.

## Day 1 architecture

```text
MotionSpec JSON
    -> Zod validation
    -> trusted MotionDesign component
    -> Remotion + optional Three.js accent
    -> 12 sampled frames
    -> correctness and temporal report
```

Six curated studies cover the initial product space:

- `KineticTitle`
- `QuoteSequence`
- `ProductLaunch`
- `MetricReveal`
- `EventPromo`
- `LogoOutro`

The renderer supports landscape, square, and portrait compositions. Three.js is
restricted to orbit, glass, and particle accents; typography remains the main
visual subject.

The frozen v1 font vocabulary is fully bundled for offline rendering:

- Inter — neutral interface and body copy
- Space Grotesk — geometric display typography
- JetBrains Mono — technical metrics and supporting copy
- Fraunces — editorial serif display typography

## Commands

```bash
npm install
sudo apt-get update
sudo apt-get install -y libnspr4 libnss3
npm test
npm run typecheck
npm run studio
npm run evaluate
npm run render:demo
```

Choose another fixture or rendering backend:

```bash
COMPOSITION_ID=EventPromo REMOTION_GL=swangle npm run evaluate
```

`angle` is the normal local backend. `swangle` is the slower software fallback
when WSL cannot expose a suitable graphics context to headless Chromium.

## Evaluation contract

The Day 1 evaluator validates infrastructure, not general aesthetic taste. It:

1. bundles the trusted renderer;
2. samples 12 evenly spaced timeline frames;
3. measures adjacent-frame pixel change;
4. checks foreground and accent contrast;
5. checks minimum text exposure time;
6. emits a machine-readable JSON report.

Later evaluation will add clipping detection, line-break quality, event density,
prompt fit, and blinded human comparisons. Generic CLIP/LAION aesthetic scores
will remain supporting signals rather than the definition of taste.

## Environment findings

- WSL exposes 16 logical CPUs, 31 GiB RAM, and 8 GiB swap.
- Node 24 and npm 11 are available.
- The system Python is 3.14, which is outside the currently supported Unsloth
  range. Training will use an isolated Python 3.12 environment.
- System Chrome and FFmpeg are absent. Remotion downloads a pinned headless
  browser and uses its supported media toolchain, so global Chrome/FFmpeg
  installs are not required. This minimal WSL image still needs the `libnspr4`
  and `libnss3` Chromium runtime packages shown above.
- CUDA inspection is blocked from the restricted agent process. Before model
  work, verify `nvidia-smi` and `torch.cuda` directly in the user WSL terminal.

## Python training environment

Training uses a project-local Python 3.12 environment because system Python
3.14 is outside Unsloth's supported range:

```bash
source .venv/bin/activate
python --version
```

For commands and CI, activation is optional:

```bash
uv run python --version
uv sync
```

`.python-version`, `pyproject.toml`, and `uv.lock` pin Python to the 3.12
release line. The lockfile also pins the verified Blackwell stack: PyTorch
2.12.1+cu130, Unsloth 2026.9.6, Triton 3.7.1, bitsandbytes 0.50.2, TRL 0.24.0,
and Transformers 5.5.0.

Verify CUDA kernels and a real 7B QLoRA backward pass:

```bash
uv run python training/smoke_test.py
uv run python training/qlora_smoke_test.py
```

Generate and validate the content-disjoint canonical dataset:

```bash
npm run data:sft
npm run data:validate
uv run python training/inspect_dataset.py
```

Run a one-step trainer check or the full one-epoch SFT:

```bash
MAX_STEPS=1 OUTPUT_DIR=training/runs/sft-smoke \
  uv run python training/train_sft.py
uv run python training/train_sft.py
```

Stop Remotion Studio and unload Ollama before training so they do not compete
for the 8 GB GPU.

### Day 3 measured SFT result

- Dataset: 480 train, 60 validation, and 60 test examples; no copy/content
  identity crosses splits.
- Token lengths: 698–750, so the trainer uses a 1,024-token sequence limit.
- QLoRA: rank 16, effective batch size 8, BF16 compute, one epoch/60 steps.
- Runtime: 17 minutes 49 seconds; peak allocated VRAM 6.29 GiB.
- Final validation loss: 0.1442.
- Six held-out prompts, same model with adapter disabled vs enabled:
  - base: 5/6 JSON, 0/6 schema-valid, 0/6 exact-copy preservation;
  - adapter: 6/6 JSON, 3/6 directly schema-valid, 4/6 after deterministic
    normalization, and 5/6 exact-copy preservation.

### Day 3 targeted correction result

`npm run data:corrections` creates 120 targeted training corrections (40 each
for contrast, metric roles, and exact-copy line boundaries), 30 unseen
correction validations, and canonical replay examples. Validate them with
`npm run data:validate-corrections`.

- The mixed correction/replay pass ran for 30 steps in 10 minutes at a
  `5e-5` learning rate.
- A boundary-focused replay pass then ran for 10 steps in 2 minutes 54 seconds
  at `2.5e-5`.
- Final adapter: `training/runs/sft-stage3-boundaries/adapter`.
- The same six content-disjoint prompts now achieve 6/6 valid JSON, direct
  schema validity, content-policy compliance, and exact-copy preservation.
- All six also pass rendered contrast, readable-duration, and motion-presence
  hard gates.

These six samples are a regression check, not a broad quality estimate. The
application must retain validation and repair. Human preference collection is
the next separate phase: only candidates passing these correctness gates should
be shown for blinded taste comparison.

## Human taste collection

`data/preferences/taste-prompts.json` contains 60 balanced prompts: ten each
for titles, quotes, products, metrics, events, and outros. Generate review
pairs in GPU-safe batches:

```bash
BATCH_SIZE=10 npm run taste:generate
```

The command automatically skips completed prompts, samples four outputs from
the final stage-three adapter, validates and render-checks them, chooses two
diverse valid candidates, randomly assigns A/B, and writes review MP4s under
`out/preferences/<prompt-id>/`. Pair manifests are stored under
`data/preferences/pairs/`.

Start the blinded local reviewer:

```bash
npm run taste:review
```

Open `http://127.0.0.1:8790`. Select A, B, tie, or reject both; add preference
strength and reason tags. Every decision is appended to
`data/preferences/reviews.jsonl`. Only A/B decisions become DPO-compatible
chosen/rejected records in `data/preferences/human.jsonl`; ties and rejected
pairs remain diagnostic records. Review ten to fifteen pairs per sitting.

## Day 4 preference optimization

The completed taste pass produced 44 decisive A/B preferences from 59 reviewed
pairs. `npm run data:dpo` excludes the legacy record, ties, and reject-both
decisions, validates both sides against the schema/content policy, and creates a
category-stratified split of 38 training and 6 validation pairs.

Run the one-step memory check or the single-epoch DPO pass:

```bash
MAX_STEPS=1 OUTPUT_DIR=training/runs/dpo-smoke \
  uv run python training/train_dpo.py
uv run python training/train_dpo.py
```

The trainer starts from `sft-stage3-boundaries`, loads a second frozen copy of
that LoRA under the `reference` adapter name, and optimizes only the `default`
adapter. This is important: disabling LoRA would incorrectly use the unfine-
tuned base model as the DPO reference.

Measured result on the RTX PRO 2000 Blackwell laptop GPU:

- rank-16 QLoRA, BF16, effective batch size 4, beta 0.1, 10 updates;
- maximum sequence length 832 (observed preference maximum: 749 tokens);
- runtime 4 hours 46 minutes due to gradient offload at the 8 GB limit;
- held-out preference loss 0.6773 versus the neutral 0.6931 baseline;
- held-out chosen/rejected accuracy 4/6 (66.7%).

This shows preference learning but does not prove better generated videos.
Generate the final blinded comparison on new prompts:

```bash
npm run compare:generate
npm run compare:review
```

Open `http://127.0.0.1:8791`, review the SFT-vs-DPO videos, then reveal the
aggregate result with `npm run compare:results`. The comparison uses separate
review files and never exposes model identity in the reviewer UI.

The completed comparison contained 11 usable unseen prompts. DPO won 4,
stage-three SFT won 2, four tied, and one pair was rejected. Its decisive win
rate was therefore 66.7%; DPO is the demo adapter, while SFT remains the
rollback.

## Day 5 demo runtime

Production generation now defaults to the winning DPO adapter through a
persistent local Unsloth sidecar. Stop Ollama first so both runtimes do not
compete for the 8 GB GPU, then launch the complete demo:

```bash
ollama stop qwen2.5-coder:7b
npm run demo
```

Open `http://127.0.0.1:8787`. The local interface includes prompt presets,
candidate count and repeatable-seed controls, progress and failure states,
render-gate results, MP4 preview, MotionSpec copy, and video download. The API
keeps the twelve newest exports under `out/generated/`.

`npm run demo` reuses an already-running sidecar or starts one, waits for the
adapter to load, starts the web/API process, and cleans up the sidecar it owns
when stopped. For separate processes or CLI use:

```bash
npm run inference:serve
npm run generate -- \
  "Exact copy: MAKE IDEAS MOVE. Use editorial type and a coral accent."
npm run api
```

The sidecar loads `training/runs/dpo-taste/adapter` once and listens only on
`127.0.0.1:8788`. The Node pipeline still performs deterministic
normalization, schema/content validation, one repair attempt, rendering hard
gates, and soft ranking. To compare or roll back to the original Ollama
baseline, start Ollama and use `npm run generate:base -- "..."` or set
`MODEL_BACKEND=ollama`. Set `DEMO_RENDER_SCALE=1` for full-resolution exports;
the default two-thirds scale is faster and produces 1280×720 from a 1080p
composition.

## Day 6 final benchmark and presentation

Run the fixed, content-disjoint final suite with the production best-of-two
configuration:

```bash
CANDIDATES=2 npm run benchmark:final
npm run demo:backup
```

The report is written to `data/results/final-dpo-latest.json`, and the
highest-scoring winner becomes `out/demo-backup.mp4` with a reproducibility
manifest at `out/demo-backup.json`.

Measured final result:

- 12/12 unseen prompts produced a render-gated winner;
- 12/12 preserved every supplied line exactly;
- 22/24 individual candidates were valid;
- the two rejected candidates failed accent contrast, while their alternates
  passed;
- 4/12 winners used model repair and one used deterministic normalization;
- mean score 83.34;
- mean generation-plus-gate latency 35.86 seconds, median 35.16 seconds, and
  p95 43.22 seconds;
- the end-to-end demo smoke test took 48.6 seconds including a 12.7-second MP4
  render.

This benchmark does not claim to measure universal taste and excludes final MP4
encoding from its latency. Use `docs/demo-runbook.md` for the live sequence and
recovery paths, and `docs/presentation-outline.md` for the evidence-based pitch.

## Day 1 verification result

- All six fixture categories bundle and render through headless Chromium.
- Landscape, square, and portrait outputs were sampled and visually reviewed.
- Every fixture passes contrast, readable-duration, and motion-presence gates.
- The interactive Remotion Studio works at `http://localhost:3000`.
- A 240-frame 1920×1080 `ProductLaunch` video exported in roughly 14 seconds.
- Unit tests: 4 passing. TypeScript and editor diagnostics: clean.

The evaluator originally averaged motion across the full timeline. That
incorrectly penalized readable static holds, so the gate now requires meaningful
motion in multiple sampled intervals instead of constant movement.

## Day 2 local generation

Install Ollama inside WSL and acquire the pinned baseline model:

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
ollama pull qwen2.5-coder:7b
```

Generate and evaluate two candidates with the original Day 2 baseline:

```bash
npm run generate:base -- \
  "Landscape launch teaser for Foundry. Copy: Intelligence stays with you."
```

Change candidate count or seed without editing code:

```bash
CANDIDATES=1 SEED=42 npm run generate:base -- "Square quote: Clarity follows motion."
```

Run the local HTTP service:

```bash
MODEL_BACKEND=ollama npm run api
curl http://127.0.0.1:8787/health
curl -X POST http://127.0.0.1:8787/generate \
  -H 'content-type: application/json' \
  -d '{"prompt":"Portrait event promo for Signal, October 24","candidateCount":2}'
```

The service sends Ollama the exact JSON Schema, validates the response, makes
one repair attempt when necessary, renders valid candidates sequentially, and
rejects anything that fails a hard gate. Soft ranking considers prompt-word
coverage, hierarchy, emphasis, line length, and restraint. These heuristics are
a baseline, not a claim that automatic scoring fully captures taste.

The benchmark suite contains 42 prompts across titles, quotes, products,
metrics, events, outros, and stress cases. Start with a three-prompt smoke run:

```bash
LIMIT=3 CANDIDATES=1 npm run benchmark
```

Set `LIMIT=42` only when an unattended full baseline run is appropriate.

### Day 2 measured baseline

- Model: `qwen2.5-coder:7b` Q4_K_M through Ollama.
- Peak observed GPU allocation: about 5.9 GiB of 8.15 GiB.
- Warm one-candidate smoke benchmark: 3/3 successful, 14.5 seconds mean
  end-to-end latency including 12-frame rendering.
- Best-of-two metric test: 2/2 valid candidates in 27 seconds.

Generated output is canonicalized before schema validation only where the
correction is deterministic: remove obvious style-description copy, clamp
tracking/accent intensity, assign one numeric line to the metric role, and
reconcile contiguous timeline duration. Every action is returned in the
generation metadata. Color contrast, invented exact-copy text, ambiguous metric
content, and render failures still require model repair or rejection.
