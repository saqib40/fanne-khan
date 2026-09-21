import {readFile} from 'node:fs/promises';
import {evaluateAndRank} from '../backend/src/rank';
import {parseMotionSpec} from '../frontend/src/schema/motion-spec';

type RecordShape = {
  id: string;
  prompt: string;
  response: string;
};

const file =
  process.env.EVAL_PATH ??
  'training/runs/sft-stage3-boundaries/heldout-sample.jsonl';
const records = (await readFile(file, 'utf8'))
  .trim()
  .split('\n')
  .map((row) => JSON.parse(row) as RecordShape);

const reports = [];
for (const record of records) {
  const firstBrace = record.response.indexOf('{');
  const lastBrace = record.response.lastIndexOf('}');
  const spec = parseMotionSpec(
    JSON.parse(record.response.slice(firstBrace, lastBrace + 1)),
  );
  const result = await evaluateAndRank({
    prompt: record.prompt,
    candidates: [
      {
        spec,
        repaired: false,
        normalized: [],
        elapsedSeconds: 0,
        seed: 3407,
        temperature: 0,
      },
    ],
  });
  reports.push({
    id: record.id,
    passed: result.ranked.length === 1,
    hardGates: result.ranked[0]?.evaluation.hardGates,
    failure: result.failures[0],
  });
}

console.log(
  JSON.stringify(
    {
      status: reports.every((report) => report.passed) ? 'success' : 'failure',
      passed: reports.filter((report) => report.passed).length,
      total: reports.length,
      reports,
    },
    null,
    2,
  ),
);
