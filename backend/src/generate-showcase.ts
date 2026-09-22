import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {generateBestMotion, type GenerationResult} from './generate';
import {checkModelRuntime} from './ollama';
import {
  closeVideoRenderer,
  renderMotionSpecToMp4,
} from './render-video';

const showcasePromptSchema = z.array(
  z.strictObject({
    id: z.string().min(1),
    category: z.string().min(1),
    theme: z.string().min(1),
    aspect: z.enum(['landscape', 'square', 'portrait']),
    palette: z.string().min(1),
    montageRole: z.string().min(1),
    prompt: z.string().min(20),
  }),
);
type ShowcasePrompt = z.infer<typeof showcasePromptSchema>[number];
type Winner = NonNullable<GenerationResult['winner']>;

type ShowcaseRecord = ShowcasePrompt & {
  seed: number;
  requestedCandidates: number;
  validCandidates: number;
  success: boolean;
  generationSeconds: number;
  generationFailures: string[];
  evaluationFailures: string[];
  outputPath: string | null;
  render: null | {
    elapsedSeconds: number;
    renderer: string;
    scale: number;
  };
  winner: null | {
    spec: Winner['spec'];
    score: number;
    repaired: boolean;
    normalized: string[];
    hardGates: Winner['evaluation']['hardGates'];
    candidateSeed: number;
    temperature: number;
  };
};

const root = process.cwd();
const promptPath = path.resolve(
  root,
  process.env.SHOWCASE_PROMPTS ??
    'data/showcase/montage-prompts.json',
);
const outputDirectory = path.resolve(
  root,
  process.env.SHOWCASE_OUTPUT ?? 'out/showcase',
);
const manifestPath = path.resolve(
  root,
  process.env.SHOWCASE_MANIFEST ??
    'data/showcase/generated-manifest.json',
);
const candidateCount = Math.max(
  1,
  Math.min(3, Number(process.env.CANDIDATES ?? 2)),
);
const seedBase = Number(process.env.SEED_BASE ?? 20261101);
const force = process.env.FORCE === '1';
const limit = Math.max(
  1,
  Number(process.env.SHOWCASE_LIMIT ?? Number.POSITIVE_INFINITY),
);

const prompts = showcasePromptSchema
  .parse(JSON.parse(await readFile(promptPath, 'utf8')))
  .slice(0, limit);
await mkdir(outputDirectory, {recursive: true});

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const loadExistingRecords = async (): Promise<ShowcaseRecord[]> => {
  try {
    const value = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      records?: ShowcaseRecord[];
    };
    return Array.isArray(value.records) ? value.records : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
};

const recordsById = new Map(
  (await loadExistingRecords()).map((record) => [record.id, record]),
);
const runtime = await checkModelRuntime();
if (!runtime.available || !runtime.installed) {
  throw new Error(
    runtime.backend === 'unsloth'
      ? 'DPO inference unavailable. Run `npm run inference:serve` first.'
      : `Model runtime unavailable: ${runtime.model}`,
  );
}

const writeManifest = async (): Promise<void> => {
  const records = prompts.flatMap((prompt) => {
    const record = recordsById.get(prompt.id);
    return record ? [record] : [];
  });
  const successful = records.filter((record) => record.success);
  const report = {
    version: '1.0',
    updatedAt: new Date().toISOString(),
    backend: runtime.backend,
    model: runtime.model,
    promptFile: path.relative(root, promptPath),
    outputDirectory: path.relative(root, outputDirectory),
    candidateCount,
    seedBase,
    summary: {
      prompts: prompts.length,
      attempted: records.length,
      successful: successful.length,
      failed: records.filter((record) => !record.success).length,
      remaining: prompts.length - records.length,
      meanScore:
        successful.length === 0
          ? null
          : Number(
              (
                successful.reduce(
                  (sum, record) => sum + (record.winner?.score ?? 0),
                  0,
                ) / successful.length
              ).toFixed(2),
            ),
    },
    records,
  };
  await mkdir(path.dirname(manifestPath), {recursive: true});
  await writeFile(manifestPath, JSON.stringify(report, null, 2));
};

try {
  for (const [index, entry] of prompts.entries()) {
    const outputPath = path.join(outputDirectory, `${entry.id}.mp4`);
    const existing = recordsById.get(entry.id);
    if (
      !force &&
      existing?.success &&
      existing.outputPath &&
      (await exists(path.resolve(root, existing.outputPath)))
    ) {
      console.error(
        `[${index + 1}/${prompts.length}] ${entry.id} — already rendered`,
      );
      continue;
    }

    const seed = seedBase + index * 1009;
    console.error(
      `[${index + 1}/${prompts.length}] ${entry.id} — generating ${candidateCount} candidate(s)`,
    );
    const generation = await generateBestMotion({
      prompt: entry.prompt,
      candidateCount,
      seed,
    });

    if (!generation.winner) {
      recordsById.set(entry.id, {
        ...entry,
        seed,
        requestedCandidates: generation.requestedCandidates,
        validCandidates: generation.validCandidates,
        success: false,
        generationSeconds: generation.elapsedSeconds,
        generationFailures: generation.generationFailures,
        evaluationFailures: generation.evaluationFailures,
        outputPath: null,
        render: null,
        winner: null,
      });
      await writeManifest();
      console.error(`  failed — no candidate passed all gates`);
      continue;
    }

    console.error(
      `  winner ${generation.winner.score.toFixed(1)} — rendering MP4`,
    );
    const render = await renderMotionSpecToMp4({
      spec: generation.winner.spec,
      outputPath,
    });
    recordsById.set(entry.id, {
      ...entry,
      seed,
      requestedCandidates: generation.requestedCandidates,
      validCandidates: generation.validCandidates,
      success: true,
      generationSeconds: generation.elapsedSeconds,
      generationFailures: generation.generationFailures,
      evaluationFailures: generation.evaluationFailures,
      outputPath: path.relative(root, outputPath),
      render,
      winner: {
        spec: generation.winner.spec,
        score: generation.winner.score,
        repaired: generation.winner.generation.repaired,
        normalized: generation.winner.generation.normalized,
        hardGates: generation.winner.evaluation.hardGates,
        candidateSeed: generation.winner.generation.seed,
        temperature: generation.winner.generation.temperature,
      },
    });
    await writeManifest();
    console.error(
      `  saved ${path.relative(root, outputPath)} in ${render.elapsedSeconds}s`,
    );
  }
} finally {
  await closeVideoRenderer();
}

await writeManifest();
const completed = [...recordsById.values()].filter(
  (record) => record.success,
).length;
console.log(
  JSON.stringify(
    {
      prompts: prompts.length,
      completed,
      failed: [...recordsById.values()].filter(
        (record) => !record.success,
      ).length,
      outputDirectory,
      manifestPath,
    },
    null,
    2,
  ),
);
