# Live Demo Runbook

## Ten minutes before presenting

1. Plug the laptop into power and close GPU-heavy Windows applications.
2. In WSL, stop the Ollama model so it cannot compete for VRAM:

   ```bash
   ollama stop qwen2.5-coder:7b
   ```

3. Start the complete local demo:

   ```bash
   npm run demo
   ```

4. Wait for both ready messages, then open `http://127.0.0.1:8787`.
5. Confirm the header says **DPO adapter ready**.
6. Click **Hero title**. Keep **2 · Recommended** and
   **Demo repeatable** selected.
7. Do not pre-run generation immediately before presenting; leave GPU memory
   and thermals settled.

## Ninety-second presentation path

1. **Set the constraint (15 seconds).**
   “This runs entirely on one 8 GB laptop GPU. The model never writes
   executable React; it writes a validated MotionSpec.”

2. **Generate (10 seconds).**
   Click **Generate motion video** on the prepared hero prompt.

3. **Explain the pipeline while waiting (30–40 seconds).**
   Point to the progress stages:
   - the DPO-tuned 7B model proposes two structured directions;
   - Zod and content policy reject malformed or invented copy;
   - twelve sampled Remotion frames enforce contrast, readability, and motion;
   - the better passing direction is rendered to H.264.

4. **Show the artifact (20 seconds).**
   Let the video loop once. Point out quality score, duration, format, and the
   four passed hard gates. Download the MP4 or copy the MotionSpec to prove the
   output is a reusable programmatic edit, not a prerecorded clip.

5. **Close with evidence (15 seconds).**
   “On twelve unseen final prompts we achieved 12/12 render-gated success and
   12/12 exact-copy preservation. DPO beat the final SFT adapter 4–2 among
   decisive blinded comparisons.”

## Stable hero prompt

```text
Create a 6-second kinetic title. Exact copy: TURN STATIC INTO SIGNAL. Use warm
ivory on deep charcoal with one coral accent, measured motion, and no extra
text.
```

Use candidate count `2` and seed `20261001`. This exact path passed end to end
with two valid candidates, a winning score of `83.64`, and all render gates.

## Recovery paths

### No winner survives

This means the safeguards worked. Keep the same prompt, choose three candidates,
and generate again. Do not weaken or bypass a hard gate during the demo.

### DPO sidecar is unavailable

Stop `npm run demo`, then restart it. The first adapter load can take about two
minutes. Verify:

```bash
curl http://127.0.0.1:8788/health
```

### Chromium cannot render through ANGLE

Restart with the software fallback:

```bash
REMOTION_GL=swangle npm run demo
```

It is slower but avoids WSL graphics-context failures.

### DPO runtime cannot be recovered

Use the original baseline only as a clearly labeled fallback:

```bash
ollama serve
ollama pull qwen2.5-coder:7b
MODEL_BACKEND=ollama npm run api
```

### Live generation is too slow

Play `out/demo-backup.mp4`, then open `out/demo-backup.json` to show the exact
prompt, score, MotionSpec, and render metadata. The backup is selected
automatically as the highest-scoring winner from the final unseen benchmark:

```bash
npm run demo:backup
```

## Claims to avoid

- Do not say DPO “proved” universal aesthetic improvement; there were only six
  decisive SFT-vs-DPO comparisons.
- Do not describe the heuristic score as human taste.
- Do not claim every raw model sample is valid. The measured candidate validity
  was 22/24; the validation and best-of-two design produced 12/12 user-level
  success.
- Do not include final MP4 encoding in the reported 35.86-second benchmark
  mean. The measured end-to-end smoke test was 48.6 seconds, including a
  12.7-second video render.
