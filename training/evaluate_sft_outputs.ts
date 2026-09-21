import {readFile} from 'node:fs/promises';
import {
  normalizeCandidate,
  validateContentPolicy,
} from '../backend/src/ollama';
import {
  motionSpecSchema,
  type MotionSpec,
} from '../frontend/src/schema/motion-spec';

type EvaluationRecord = {
  id: string;
  kind: string;
  prompt: string;
  reference: string;
  response: string;
};

const extractJson = (response: string): unknown => {
  const firstBrace = response.indexOf('{');
  const lastBrace = response.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No JSON object found');
  }
  return JSON.parse(response.slice(firstBrace, lastBrace + 1));
};

const file =
  process.env.EVAL_PATH ??
  'training/runs/sft-qwen2.5-coder-7b/heldout-sample.jsonl';
const records = (await readFile(file, 'utf8'))
  .trim()
  .split('\n')
  .map((row) => JSON.parse(row) as EvaluationRecord);

const results = records.map((record) => {
  let spec: MotionSpec | undefined;
  let candidate: unknown;
  let syntaxValid = false;
  let schemaValid = false;
  let normalizedSchemaValid = false;
  let error: string | undefined;
  try {
    candidate = extractJson(record.response);
    syntaxValid = true;
    const parsed = motionSpecSchema.safeParse(candidate);
    if (!parsed.success) {
      error = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
    } else {
      schemaValid = true;
      spec = parsed.data;
    }
    normalizedSchemaValid = motionSpecSchema.safeParse(
      normalizeCandidate(candidate).value,
    ).success;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  const contentIssues = syntaxValid
    ? validateContentPolicy({request: record.prompt, value: candidate})
    : [];
  const exactCopy =
    record.prompt
      .match(/Exact copy:\s*(.*?)\.\s*Style direction:/i)?.[1]
      ?.split('/')
      .map((text) => text.trim()) ?? [];
  const shaped = candidate as
    | {segments?: Array<{lines?: Array<{text?: unknown}>}>}
    | undefined;
  const renderedCopy =
    shaped?.segments?.flatMap(
      (segment) =>
        segment.lines
          ?.map((textLine) => textLine.text)
          .filter((text): text is string => typeof text === 'string') ?? [],
    ) ?? [];
  const missingCopy = exactCopy.filter((text) => !renderedCopy.includes(text));
  const extraCopy = renderedCopy.filter((text) => !exactCopy.includes(text));

  return {
    id: record.id,
    kind: record.kind,
    syntaxValid,
    schemaValid,
    normalizedSchemaValid,
    contentPolicyValid: contentIssues.length === 0,
    exactCopyPreserved: missingCopy.length === 0 && extraCopy.length === 0,
    missingCopy,
    extraCopy,
    contentIssues,
    error,
  };
});

console.log(
  JSON.stringify(
    {
      status: results.every(
        (result) =>
          result.schemaValid &&
          result.contentPolicyValid &&
          result.exactCopyPreserved,
      )
        ? 'success'
        : 'failure',
      summary: {
        records: results.length,
        syntaxValid: results.filter((result) => result.syntaxValid).length,
        schemaValid: results.filter((result) => result.schemaValid).length,
        normalizedSchemaValid: results.filter(
          (result) => result.normalizedSchemaValid,
        ).length,
        contentPolicyValid: results.filter(
          (result) => result.contentPolicyValid,
        ).length,
        exactCopyPreserved: results.filter(
          (result) => result.exactCopyPreserved,
        ).length,
      },
      results,
    },
    null,
    2,
  ),
);
