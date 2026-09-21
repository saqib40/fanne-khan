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
import {normalizeCandidate, validateContentPolicy} from '../backend/src/ollama';
import {MOTION_DESIGN_SYSTEM_PROMPT} from '../backend/src/prompt';
import {evaluateAndRank, type RankedCandidate} from '../backend/src/rank';
import {motionSpecSchema} from '../frontend/src/schema/motion-spec';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.LD_LIBRARY_PATH = [
  path.join(root, '.cache/system-libs/usr/lib/x86_64-linux-gnu'),
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

const requestedGl = (process.env.REMOTION_GL ?? 'angle') as OpenGlRenderer;
const renderScale = z.coerce
  .number()
  .min(0.25)
  .max(1)
  .parse(process.env.TASTE_RENDER_SCALE ?? 2 / 3);
const adapters = {
  sft: path.join(
    root,
    'training/runs/sft-stage3-boundaries/adapter',
  ),
  dpo: path.join(root, 'training/runs/dpo-taste/adapter'),
} as const;
const pairDirectory = path.join(
  root,
  'data/preferences/comparison-pairs',
);
const videoRoot = path.join(root, 'out/comparison');
const cacheDirectory = path.join(root, '.cache/comparison');
const requestsPath = path.join(cacheDirectory, 'requests.json');

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

const runSampler = (
  adapter: string,
  output: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'uv',
      ['run', 'python', 'training/generate_taste_candidates.py'],
      {
        cwd: root,
        env: {
          ...process.env,
          ADAPTER_DIR: adapter,
          TASTE_REQUESTS: requestsPath,
          TASTE_CANDIDATES: output,
        },
        stdio: 'inherit',
      },
    );
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Sampler exited with code ${code}`)),
    );
  });

const readCandidates = async (file: string): Promise<RawCandidate[]> =>
  (await readFile(file, 'utf8'))
    .trim()
    .split('\n')
    .map((row) => candidateSchema.parse(JSON.parse(row)));

const selectCandidate = async (
  prompt: Prompt,
  candidates: RawCandidate[],
): Promise<RankedCandidate> => {
  const valid = candidates
    .filter((candidate) => candidate.promptId === prompt.id)
    .flatMap((candidate) => {
      try {
        const normalized = normalizeCandidate(extractJson(candidate.response));
        const parsed = motionSpecSchema.safeParse(normalized.value);
        if (!parsed.success) return [];
        if (
          validateContentPolicy({
            request: prompt.prompt,
            value: parsed.data,
          }).length > 0
        ) {
          return [];
        }
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
      valid.map((candidate) => [JSON.stringify(candidate.spec), candidate]),
    ).values(),
  ];
  if (unique.length === 0) {
    throw new Error(`No valid candidates for ${prompt.id}`);
  }
  const evaluated = await evaluateAndRank({
    prompt: prompt.prompt,
    candidates: unique,
  });
  if (evaluated.ranked.length === 0) {
    throw new Error(`No candidate passed hard gates for ${prompt.id}`);
  }
  return evaluated.ranked[0];
};

const prompts = z
  .array(promptSchema)
  .length(12)
  .parse(
    JSON.parse(
      await readFile(
        path.join(root, 'data/preferences/comparison-prompts.json'),
        'utf8',
      ),
    ),
  );
await Promise.all([
  mkdir(pairDirectory, {recursive: true}),
  mkdir(videoRoot, {recursive: true}),
  mkdir(cacheDirectory, {recursive: true}),
]);
await writeFile(
  requestsPath,
  JSON.stringify(
    prompts.map((prompt, index) => ({
      ...prompt,
      system: MOTION_DESIGN_SYSTEM_PROMPT,
      seed: 20261001 + index * 1009,
    })),
    null,
    2,
  ),
);

const candidateFiles = {
  sft: path.join(cacheDirectory, 'sft-candidates.jsonl'),
  dpo: path.join(cacheDirectory, 'dpo-candidates.jsonl'),
};
await runSampler(adapters.sft, candidateFiles.sft);
await runSampler(adapters.dpo, candidateFiles.dpo);
const sampled = {
  sft: await readCandidates(candidateFiles.sft),
  dpo: await readCandidates(candidateFiles.dpo),
};

await ensureBrowser();
const serveUrl = await bundle({
  entryPoint: path.join(root, 'frontend/src/index.ts'),
  webpackOverride: (configuration) => configuration,
});
const browser = await openBrowser('chrome', {
  chromiumOptions: {gl: requestedGl},
  logLevel: 'warn',
});
const results: Array<{id: string; status: string; reason?: string}> = [];

for (const prompt of prompts) {
  try {
    const selected = {
      sft: await selectCandidate(prompt, sampled.sft),
      dpo: await selectCandidate(prompt, sampled.dpo),
    };
    const order =
      hash(prompt.id) % 2 === 0
        ? (['sft', 'dpo'] as const)
        : (['dpo', 'sft'] as const);
    const videoDirectory = path.join(videoRoot, prompt.id);
    await mkdir(videoDirectory, {recursive: true});

    for (const [index, side] of ['A', 'B'].entries()) {
      const candidate = selected[order[index]];
      const inputProps = {spec: candidate.spec};
      const composition = await selectComposition({
        serveUrl,
        id: 'Generated',
        inputProps,
        chromiumOptions: {gl: requestedGl},
        puppeteerInstance: browser,
      });
      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: path.join(videoDirectory, `${side}.mp4`),
        inputProps,
        chromiumOptions: {gl: requestedGl},
        puppeteerInstance: browser,
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

    const manifestCandidate = (
      model: 'sft' | 'dpo',
      candidate: RankedCandidate,
    ) => ({
      spec: candidate.spec,
      generation: {...candidate.generation, model},
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
          comparison: 'stage3-sft-vs-dpo',
          candidates: {
            A: manifestCandidate(order[0], selected[order[0]]),
            B: manifestCandidate(order[1], selected[order[1]]),
          },
          videos: {
            A: `out/comparison/${prompt.id}/A.mp4`,
            B: `out/comparison/${prompt.id}/B.mp4`,
          },
        },
        null,
        2,
      ),
    );
    results.push({id: prompt.id, status: 'success'});
    console.log(`rendered comparison ${prompt.id}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    results.push({id: prompt.id, status: 'failure', reason});
    console.error(`failed ${prompt.id}: ${reason}`);
  }
}

await browser.close({silent: true});
console.log(JSON.stringify({status: 'complete', results}, null, 2));
