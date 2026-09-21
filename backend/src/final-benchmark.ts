import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {
  generateBestMotion,
  type GenerationResult,
} from './generate';
import {checkModelRuntime} from './ollama';

const promptSchema = z.array(
  z.strictObject({
    id: z.string(),
    category: z.enum([
      'title',
      'quote',
      'product',
      'metric',
      'event',
      'outro',
    ]),
    prompt: z.string().min(20),
  }),
);
type BenchmarkPrompt = z.infer<typeof promptSchema>[number];
type Winner = NonNullable<GenerationResult['winner']>;
type BenchmarkRecord = {
  id: string;
  category: BenchmarkPrompt['category'];
  prompt: string;
  success: boolean;
  exactCopyPreserved: boolean;
  expectedLines: string[];
  renderedLines: string[];
  missingLines: string[];
  unexpectedLines: string[];
  requestedCandidates: number;
  validCandidates: number;
  generationFailures: string[];
  evaluationFailures: string[];
  elapsedSeconds: number;
  winner: null | {
    spec: Winner['spec'];
    score: number;
    repaired: boolean;
    normalized: string[];
    hardGates: Winner['evaluation']['hardGates'];
    evaluatorSeconds: number;
  };
};

const mean = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Number(
        (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(
          2,
        ),
      );

const percentile = (values: number[], fraction: number): number | null => {
  if (values.length === 0) return null;
  const ordered = [...values].sort((first, second) => first - second);
  return Number(
    ordered[Math.round((ordered.length - 1) * fraction)].toFixed(2),
  );
};

const expectedCopy = (prompt: string): string[] => {
  const match = prompt.match(
    /\bexact copy:\s*(.*?)\.\s*style direction:/i,
  );
  return (
    match?.[1]
      .split(/\s+\/\s+/)
      .map((line) => line.trim())
      .filter(Boolean) ?? []
  );
};

const status = await checkModelRuntime();
if (!status.available || !status.installed) {
  throw new Error(
    status.backend === 'unsloth'
      ? 'DPO inference unavailable. Run `npm run inference:serve` first.'
      : `Ollama model unavailable: ${status.model}`,
  );
}

const root = process.cwd();
const promptPath = path.resolve(
  root,
  process.env.FINAL_BENCHMARK_FILE ??
    'data/benchmarks/final-prompts.json',
);
const prompts = promptSchema.parse(
  JSON.parse(await readFile(promptPath, 'utf8')),
);
const candidateCount = Math.max(
  1,
  Math.min(3, Number(process.env.CANDIDATES ?? 2)),
);
const records: BenchmarkRecord[] = [];

for (const [index, entry] of prompts.entries()) {
  console.error(`[${index + 1}/${prompts.length}] ${entry.id}`);
  const result = await generateBestMotion({
    prompt: entry.prompt,
    candidateCount,
    seed: 20261020 + index * 1009,
  });
  const renderedLines =
    result.winner?.spec.segments.flatMap((segment) =>
      segment.lines.map((line) => line.text),
    ) ?? [];
  const expectedLines = expectedCopy(entry.prompt);
  const missingLines = expectedLines.filter(
    (line) => !renderedLines.includes(line),
  );
  const unexpectedLines = renderedLines.filter(
    (line) => !expectedLines.includes(line),
  );
  const exactCopyPreserved =
    Boolean(result.winner) &&
    expectedLines.length > 0 &&
    missingLines.length === 0 &&
    unexpectedLines.length === 0;

  records.push({
    id: entry.id,
    category: entry.category,
    prompt: entry.prompt,
    success: Boolean(result.winner),
    exactCopyPreserved,
    expectedLines,
    renderedLines,
    missingLines,
    unexpectedLines,
    requestedCandidates: result.requestedCandidates,
    validCandidates: result.validCandidates,
    generationFailures: result.generationFailures,
    evaluationFailures: result.evaluationFailures,
    elapsedSeconds: result.elapsedSeconds,
    winner: result.winner
      ? {
          spec: result.winner.spec,
          score: result.winner.score,
          repaired: result.winner.generation.repaired,
          normalized: result.winner.generation.normalized,
          hardGates: result.winner.evaluation.hardGates,
          evaluatorSeconds: result.winner.evaluation.elapsedSeconds,
        }
      : null,
  });
}

const successful = records.filter((record) => record.success);
const latencies = records.map((record) => record.elapsedSeconds);
const categories = Object.fromEntries(
  [...new Set(records.map((record) => record.category))].map((category) => {
    const categoryRecords = records.filter(
      (record) => record.category === category,
    );
    const categorySuccesses = categoryRecords.filter(
      (record) => record.success,
    );
    return [
      category,
      {
        prompts: categoryRecords.length,
        successful: categorySuccesses.length,
        exactCopy: categoryRecords.filter(
          (record) => record.exactCopyPreserved,
        ).length,
        meanLatencySeconds: mean(
          categoryRecords.map((record) => record.elapsedSeconds),
        ),
        meanScore: mean(
          categorySuccesses.flatMap((record) =>
            record.winner ? [record.winner.score] : [],
          ),
        ),
      },
    ];
  }),
);
const totalCandidates = records.reduce(
  (sum, record) => sum + record.requestedCandidates,
  0,
);
const validCandidates = records.reduce(
  (sum, record) => sum + record.validCandidates,
  0,
);
const report = {
  version: '1.0',
  createdAt: new Date().toISOString(),
  evaluationScope:
    'DPO generation, deterministic normalization, schema/content validation, repair, and 12-frame render hard gates; final MP4 encoding excluded',
  backend: status.backend,
  model: status.model,
  promptFile: path.relative(root, promptPath),
  candidateCount,
  summary: {
    prompts: records.length,
    successful: successful.length,
    successRate: Number((successful.length / records.length).toFixed(3)),
    exactCopyPreserved: records.filter(
      (record) => record.exactCopyPreserved,
    ).length,
    exactCopyRate: Number(
      (
        records.filter((record) => record.exactCopyPreserved).length /
        records.length
      ).toFixed(3),
    ),
    totalCandidates,
    validCandidates,
    candidateValidityRate: Number(
      (validCandidates / totalCandidates).toFixed(3),
    ),
    winnersRepaired: successful.filter(
      (record) => record.winner?.repaired,
    ).length,
    winnersNormalized: successful.filter(
      (record) => (record.winner?.normalized.length ?? 0) > 0,
    ).length,
    meanScore: mean(
      successful.flatMap((record) =>
        record.winner ? [record.winner.score] : [],
      ),
    ),
    latencySeconds: {
      mean: mean(latencies),
      median: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      maximum: percentile(latencies, 1),
    },
  },
  categories,
  records,
};

const outputDirectory = path.join(root, 'data/results');
await mkdir(outputDirectory, {recursive: true});
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(outputDirectory, `final-dpo-${timestamp}.json`);
const latest = path.join(outputDirectory, 'final-dpo-latest.json');
await Promise.all([
  writeFile(output, JSON.stringify(report, null, 2)),
  writeFile(latest, JSON.stringify(report, null, 2)),
]);
console.log(
  JSON.stringify(
    {
      ...report.summary,
      categories,
      output,
      latest,
    },
    null,
    2,
  ),
);
