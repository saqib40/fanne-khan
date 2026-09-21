# Presentation Outline

Target: 5-minute pitch plus 2 minutes of questions.

## Slide 1 — Motion graphics should not require cloud generation

**Headline:** Prompt-to-motion video, fully local on one laptop.

- Short kinetic-typography videos are valuable but slow to produce manually.
- General text-to-video models are heavy, opaque, and unreliable with exact
  copy.
- Fanne Khan turns a brief into an editable motion plan and trusted render.

**Say:** “We narrowed the problem deliberately: excellent moving typography,
not arbitrary cinema.”

## Slide 2 — Constrain generation, expand reliability

**Visual:** Prompt → MotionSpec JSON → validation → trusted Remotion renderer.

- The 7B model chooses copy hierarchy, typography, palette, timing, layout,
  transitions, and restrained 3D accents.
- Zod rejects unknown structure and inaccessible color combinations.
- The model never generates or executes React or JavaScript.
- Bundled fonts and motion primitives keep every render offline and
  deterministic.

**Say:** “The model directs; trusted code performs.”

## Slide 3 — Correctness before taste

**Visual:** Four hard-gate checks around sampled frames.

- Foreground/background contrast: at least 4.5:1.
- Accent/background contrast: at least 3:1.
- Minimum readable exposure: 1.5 seconds.
- Motion must appear across multiple sampled intervals.
- Exact-copy policy rejects invented words and changed line boundaries.

**Say:** “Aesthetic ranking only happens after correctness. Bad output cannot
win by looking interesting.”

## Slide 4 — Teaching a small model the contract

**Visual:** Base → SFT → targeted correction → DPO.

- Canonical SFT: 480 train, 60 validation, 60 test examples with disjoint copy.
- QLoRA rank 16, BF16, one epoch on an 8 GB RTX PRO 2000 Blackwell laptop GPU.
- Initial SFT runtime: 17 minutes 49 seconds; peak allocated VRAM: 6.29 GiB.
- Targeted passes corrected contrast, metric-role, and exact line-boundary
  failures.
- Final stage-three regression: 6/6 schema-valid, policy-compliant,
  exact-copy-preserving, and render-gate passing.

**Say:** “Most gains came from fixing concrete failure classes, not simply
training longer.”

## Slide 5 — Learning visual preference

**Visual:** Blinded A/B review → chosen/rejected pairs → DPO adapter.

- 59 generated pairs reviewed; 44 decisive human preferences.
- Ties and reject-both decisions stayed diagnostic and were excluded from DPO.
- Category-stratified DPO split: 38 train, 6 validation.
- Held-out DPO preference accuracy: 4/6; loss 0.6773 versus neutral 0.6931.
- On 11 fresh blinded SFT-vs-DPO comparisons:
  - DPO won 4;
  - SFT won 2;
  - 4 tied;
  - 1 rejected both.
- DPO decisive win rate: 66.7%.

**Say:** “This is promising evidence, not a universal taste claim; the sample
is deliberately reported with its limits.”

## Slide 6 — Final unseen benchmark

**Visual:** Open the benchmark results canvas.

- 12/12 prompts produced a render-gated winner.
- 12/12 preserved every supplied line exactly.
- 22/24 raw candidates were valid.
- Four winners used model repair; one used deterministic normalization.
- Mean quality score: 83.34.
- Generation plus twelve-frame gate latency:
  - mean 35.86 seconds;
  - median 35.16 seconds;
  - p95 43.22 seconds.
- End-to-end smoke test: 48.6 seconds, including 12.7 seconds for MP4 encoding.

**Say:** “The two invalid candidates failed accent contrast and were rejected.
Best-of-two still delivered 12/12 user-level success—validation is part of the
product.”

## Slide 7 — Live demo and takeaway

Run the stable hero prompt from `docs/demo-runbook.md`.

While it generates, reinforce:

1. Fully local DPO inference.
2. Structured and editable output.
3. Automatic correctness gates.
4. Programmatic MP4 rendering and download.

**Close:** “On consumer hardware, useful generative video does not require
guessing at pixels. Constrain the creative language, learn human preference,
and make correctness executable.”

## Architecture backup slide

```text
Browser UI :8787
    │
    ├── POST /generate
    │       │
    │       ├── Unsloth sidecar :8788
    │       │       └── Qwen2.5-Coder-7B + DPO LoRA (4-bit)
    │       │
    │       ├── MotionSpec normalization + Zod/content policy
    │       ├── Remotion 12-frame hard-gate evaluation
    │       ├── soft ranking of passing candidates
    │       └── H.264 render through trusted components
    │
    └── GET /video/<generation>.mp4
```

## Likely judge questions

### Why not generate React directly?

Arbitrary React is unsafe, hard to validate, and frequently fails at runtime.
MotionSpec preserves creative decisions while keeping execution deterministic.

### Why DPO instead of a larger model?

The hardware target is an 8 GB laptop GPU. DPO teaches domain taste using 44
local preferences without increasing inference size or requiring cloud compute.

### Is the heuristic score your definition of taste?

No. It ranks only candidates that already pass correctness gates. Taste was
measured separately with blinded human comparisons.

### Why were only 91.7% of candidates valid?

Two candidates failed the enforced accent-contrast rule. The system rejected
them and selected passing alternatives, producing 100% prompt-level success.

### What would you improve next?

- collect several hundred preferences from multiple reviewers;
- measure inter-rater agreement;
- add in-process frame evaluation to remove repeated bundling overhead;
- expand the trusted motion vocabulary without changing the safety boundary;
- export a merged quantized model for a single-runtime deployment after
  validating quality parity.
