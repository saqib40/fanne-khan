import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {generateBestMotion} from './generate';
import {checkModelRuntime} from './ollama';

const promptSchema = z.array(
  z.strictObject({
    id: z.string(),
    category: z.string(),
    prompt: z.string().min(3),
  }),
);

const status = await checkModelRuntime();
if (!status.available || !status.installed) {
  console.error(
    status.backend === 'unsloth'
      ? 'DPO inference unavailable. Run `npm run inference:serve` first.'
      : `Ollama/model unavailable. Start Ollama and run \`ollama pull ${status.model}\`.`,
  );
  process.exit(1);
}

const root = process.cwd();
const records = promptSchema.parse(
  JSON.parse(
    await readFile(
      path.join(root, 'data', 'benchmarks', 'baseline-prompts.json'),
      'utf8',
    ),
  ),
);
const limit = Math.max(
  1,
  Math.min(records.length, Number(process.env.LIMIT ?? 3)),
);
const candidateCount = Math.max(
  1,
  Math.min(3, Number(process.env.CANDIDATES ?? 1)),
);
const selected = records.slice(0, limit);
const results = [];

for (const [index, record] of selected.entries()) {
  console.error(`[${index + 1}/${selected.length}] ${record.id}`);
  const result = await generateBestMotion({
    prompt: record.prompt,
    candidateCount,
    seed: 20260918 + index * 1009,
  });
  results.push({...record, result});
}

const successful = results.filter((record) => record.result.winner);
const report = {
  createdAt: new Date().toISOString(),
  backend: status.backend,
  model: status.model,
  candidateCount,
  prompts: results.length,
  successful: successful.length,
  successRate: successful.length / results.length,
  meanLatencySeconds:
    successful.length === 0
      ? null
      : successful.reduce(
          (sum, record) => sum + record.result.elapsedSeconds,
          0,
        ) / successful.length,
  results,
};
const directory = path.join(root, 'data', 'results');
await mkdir(directory, {recursive: true});
const output = path.join(
  directory,
  `baseline-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({...report, results: undefined, output}, null, 2));
