import {spawn} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {
  ensureBrowser,
  openBrowser,
  renderMedia,
  selectComposition,
  type OpenGlRenderer,
} from '@remotion/renderer';
import {z} from 'zod';
import {evaluateAndRank, type RankedCandidate} from '../backend/src/rank';
import {
  normalizeCandidate,
  validateContentPolicy,
} from '../backend/src/ollama';
import {MOTION_DESIGN_SYSTEM_PROMPT} from '../backend/src/prompt';
import {
  motionSpecSchema,
  type MotionSpec,
} from '../frontend/src/schema/motion-spec';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localLibraryDirectory = path.join(
  root,
  '.cache',
  'system-libs',
  'usr',
  'lib',
  'x86_64-linux-gnu',
);
process.env.LD_LIBRARY_PATH = [
  localLibraryDirectory,
  process.env.LD_LIBRARY_PATH,
]
  .filter(Boolean)
  .join(':');

const promptSchema = z.strictObject({
  id: z.string().regex(/^taste-[a-z]+-\d{2}$/),
  category: z.enum(['title', 'quote', 'product', 'metric', 'event', 'outro']),
  prompt: z.string().trim().min(20).max(600),
});
const candidateSchema = z.strictObject({
  promptId: z.string(),
  category: z.string(),
  prompt: z.string(),
  candidateIndex: z.number().int(),
  seed: z.number().int(),
  temperature: z.number(),
  response: z.string(),
});
type Prompt = z.infer<typeof promptSchema>;
type RawCandidate = z.infer<typeof candidateSchema>;

const batchSize = z.coerce
  .number()
  .int()
  .min(1)
  .max(10)
  .parse(process.env.BATCH_SIZE ?? 10);
const requestedGl = (process.env.REMOTION_GL ?? 'angle') as OpenGlRenderer;
const renderScale = z.coerce
  .number()
  .min(0.25)
  .max(1)
  .parse(process.env.TASTE_RENDER_SCALE ?? 2 / 3);
const adapterDirectory =
  process.env.ADAPTER_DIR ??
  path.join(
    root,
    'training',
    'runs',
    'sft-stage3-boundaries',
    'adapter',
  );
const promptFile = path.join(
  root,
  'data',
  'preferences',
  'taste-prompts.json',
);
const pairDirectory = path.join(root, 'data', 'preferences', 'pairs');
const videoRoot = path.join(root, 'out', 'preferences');
const cacheDirectory = path.join(root, '.cache', 'taste');
const requestsPath = path.join(cacheDirectory, 'requests.json');
const candidatesPath = path.join(cacheDirectory, 'candidates.jsonl');

const extractJson = (response: string): unknown => {
  const firstBrace = response.indexOf('{');
  const lastBrace = response.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No JSON object found');
  }
  return JSON.parse(response.slice(firstBrace, lastBrace + 1));
};

const hash = (value: string): number => {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const runPythonSampler = async (): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'uv',
      ['run', 'python', 'training/generate_taste_candidates.py'],
      {
        cwd: root,
        env: {
          ...process.env,
          ADAPTER_DIR: adapterDirectory,
          TASTE_REQUESTS: requestsPath,
          TASTE_CANDIDATES: candidatesPath,
        },
        stdio: 'inherit',
      },
    );
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Candidate sampler exited with code ${code}`));
      }
    });
  });

const candidateDistance = (
  first: MotionSpec,
  second: MotionSpec,
): number => {
  let score = 0;
  if (first.palette.background !== second.palette.background) score += 3;
  if (first.palette.accent !== second.palette.accent) score += 2;
  if (first.typography.display !== second.typography.display) score += 3;
  if (first.typography.uppercaseTitles !== second.typography.uppercaseTitles)
    score += 1;
  if (first.accent.type !== second.accent.type) score += 2;
  if (first.segments[0].layout !== second.segments[0].layout) score += 2;
  if (first.segments[0].entrance !== second.segments[0].entrance) score += 2;
  if (first.segments[0].exit !== second.segments[0].exit) score += 1;
  if (first.durationInFrames !== second.durationInFrames) score += 1;
  return score;
};

const chooseDiversePair = (
  candidates: RankedCandidate[],
): [RankedCandidate, RankedCandidate] => {
  if (candidates.length < 2) {
    throw new Error('Fewer than two candidates passed render hard gates');
  }
  let best: [RankedCandidate, RankedCandidate] = [
    candidates[0],
    candidates[1],
  ];
  let bestDistance = candidateDistance(best[0].spec, best[1].spec);
  for (let first = 0; first < candidates.length; first++) {
    for (let second = first + 1; second < candidates.length; second++) {
      const distance = candidateDistance(
        candidates[first].spec,
        candidates[second].spec,
      );
      if (distance > bestDistance) {
        best = [candidates[first], candidates[second]];
        bestDistance = distance;
      }
    }
  }
  return best;
};

const prompts = z
  .array(promptSchema)
  .length(60)
  .parse(JSON.parse(await readFile(promptFile, 'utf8')));
await Promise.all([
  mkdir(pairDirectory, {recursive: true}),
  mkdir(videoRoot, {recursive: true}),
  mkdir(cacheDirectory, {recursive: true}),
]);
const pending: Prompt[] = [];
for (const prompt of prompts) {
  try {
    await readFile(path.join(pairDirectory, `${prompt.id}.json`));
  } catch {
    pending.push(prompt);
  }
}
const batch = pending.slice(0, batchSize);
if (batch.length === 0) {
  console.log(
    JSON.stringify({status: 'success', message: 'All prompt pairs exist'}),
  );
  process.exit(0);
}

await writeFile(
  requestsPath,
  JSON.stringify(
    batch.map((prompt, index) => ({
      ...prompt,
      system: MOTION_DESIGN_SYSTEM_PROMPT,
      seed: 20260919 + (prompts.indexOf(prompt) + index) * 1009,
    })),
    null,
    2,
  ),
);
await runPythonSampler();
const sampled = (await readFile(candidatesPath, 'utf8'))
  .trim()
  .split('\n')
  .map((row) => candidateSchema.parse(JSON.parse(row)));

await ensureBrowser();
const serveUrl = await bundle({
  entryPoint: path.join(root, 'frontend', 'src', 'index.ts'),
  webpackOverride: (configuration) => configuration,
});
const puppeteerInstance = await openBrowser('chrome', {
  chromiumOptions: {gl: requestedGl},
  logLevel: 'warn',
});
const results: Array<{
  promptId: string;
  status: 'success' | 'failure';
  reason?: string;
}> = [];

for (const prompt of batch) {
  try {
    const valid = sampled
      .filter((candidate) => candidate.promptId === prompt.id)
      .flatMap((candidate) => {
        try {
          const normalized = normalizeCandidate(
            extractJson(candidate.response),
          );
          const parsed = motionSpecSchema.safeParse(normalized.value);
          if (!parsed.success) return [];
          const issues = validateContentPolicy({
            request: prompt.prompt,
            value: parsed.data,
          });
          if (issues.length > 0) return [];
          return [
            {
              spec: parsed.data,
              repaired: false,
              normalized: normalized.actions,
              elapsedSeconds: 0,
              seed: candidate.seed,
              temperature: candidate.temperature,
            },
          ];
        } catch {
          return [];
        }
      });
    const unique = [
      ...new Map(
        valid.map((candidate) => [
          JSON.stringify(candidate.spec),
          candidate,
        ]),
      ).values(),
    ];
    if (unique.length < 2) {
      throw new Error(
        `Only ${unique.length} unique candidate(s) passed schema and policy`,
      );
    }
    const evaluated = await evaluateAndRank({
      prompt: prompt.prompt,
      candidates: unique,
    });
    const selected = chooseDiversePair(evaluated.ranked);
    const [candidateA, candidateB] =
      hash(prompt.id) % 2 === 0 ? selected : [selected[1], selected[0]];
    const videoDirectory = path.join(videoRoot, prompt.id);
    await mkdir(videoDirectory, {recursive: true});

    for (const [side, candidate] of [
      ['A', candidateA],
      ['B', candidateB],
    ] as const) {
      const inputProps = {spec: candidate.spec};
      const composition = await selectComposition({
        serveUrl,
        id: 'Generated',
        inputProps,
        chromiumOptions: {gl: requestedGl},
        puppeteerInstance,
      });
      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: path.join(videoDirectory, `${side}.mp4`),
        inputProps,
        chromiumOptions: {gl: requestedGl},
        puppeteerInstance,
        concurrency: 1,
        scale: renderScale,
        crf: 20,
        imageFormat: 'jpeg',
        jpegQuality: 85,
        pixelFormat: 'yuv420p',
        overwrite: true,
        logLevel: 'warn',
      });
    }

    const toManifestCandidate = (candidate: RankedCandidate) => ({
      spec: candidate.spec,
      generation: candidate.generation,
      hardGates: candidate.evaluation.hardGates,
    });
    await writeFile(
      path.join(pairDirectory, `${prompt.id}.json`),
      JSON.stringify(
        {
          version: '1.0',
          id: prompt.id,
          category: prompt.category,
          prompt: prompt.prompt,
          createdAt: new Date().toISOString(),
          model: 'Qwen2.5-Coder-7B-Instruct + stage3 LoRA',
          candidates: {
            A: toManifestCandidate(candidateA),
            B: toManifestCandidate(candidateB),
          },
          videos: {
            A: `out/preferences/${prompt.id}/A.mp4`,
            B: `out/preferences/${prompt.id}/B.mp4`,
          },
        },
        null,
        2,
      ),
    );
    results.push({promptId: prompt.id, status: 'success'});
    console.log(`rendered ${prompt.id}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    results.push({promptId: prompt.id, status: 'failure', reason});
    console.error(`failed ${prompt.id}: ${reason}`);
  }
}

await puppeteerInstance.close({silent: true});
console.log(
  JSON.stringify(
    {
      status: results.every((result) => result.status === 'success')
        ? 'success'
        : 'partial',
      generated: results.filter((result) => result.status === 'success').length,
      failed: results.filter((result) => result.status === 'failure').length,
      remaining: pending.length - results.filter(
        (result) => result.status === 'success',
      ).length,
      results,
    },
    null,
    2,
  ),
);
