import {readFile, writeFile} from 'node:fs/promises';
import {MOTION_DESIGN_SYSTEM_PROMPT} from '../backend/src/prompt';
import {validateContentPolicy} from '../backend/src/ollama';
import {parseMotionSpec} from '../frontend/src/schema/motion-spec';

type PreferenceRecord = {
  id: string;
  pairId?: string;
  prompt: string;
  chosen: unknown;
  rejected: unknown;
  strength?: string;
  reasons?: string[];
  source: string;
};

const categories = [
  'title',
  'quote',
  'product',
  'metric',
  'event',
  'outro',
] as const;
type Category = (typeof categories)[number];

const allHumanRecords = (await readFile(
  'data/preferences/human.jsonl',
  'utf8',
))
  .trim()
  .split('\n')
  .map((row) => JSON.parse(row) as PreferenceRecord);
const records = allHumanRecords.filter(
    (record): record is PreferenceRecord & {pairId: string} =>
      record.source === 'human-blinded-pair' &&
      typeof record.pairId === 'string' &&
      record.pairId.startsWith('taste-'),
  );
const diagnosticReviews = (await readFile(
  'data/preferences/reviews.jsonl',
  'utf8',
))
  .trim()
  .split('\n')
  .map((row) => JSON.parse(row) as {choice: string})
  .filter(
    (review) => review.choice === 'tie' || review.choice === 'reject-both',
  );

const categoryOf = (pairId: string): Category => {
  const category = pairId.split('-')[1];
  if (!categories.includes(category as Category)) {
    throw new Error(`Unknown category in ${pairId}`);
  }
  return category as Category;
};

const validated = records.map((record) => {
  const chosen = parseMotionSpec(record.chosen);
  const rejected = parseMotionSpec(record.rejected);
  if (JSON.stringify(chosen) === JSON.stringify(rejected)) {
    throw new Error(`${record.pairId} has identical chosen and rejected specs`);
  }
  const chosenIssues = validateContentPolicy({
    request: record.prompt,
    value: chosen,
  });
  const rejectedIssues = validateContentPolicy({
    request: record.prompt,
    value: rejected,
  });
  if (chosenIssues.length > 0 || rejectedIssues.length > 0) {
    throw new Error(
      `${record.pairId} violates content policy: ${[
        ...chosenIssues,
        ...rejectedIssues,
      ].join('; ')}`,
    );
  }
  return {
    id: record.pairId,
    category: categoryOf(record.pairId),
    prompt: [
      {role: 'system', content: MOTION_DESIGN_SYSTEM_PROMPT},
      {role: 'user', content: record.prompt},
    ],
    chosen: [{role: 'assistant', content: JSON.stringify(chosen)}],
    rejected: [{role: 'assistant', content: JSON.stringify(rejected)}],
    metadata: {
      strength: record.strength ?? 'clear',
      reasons: record.reasons ?? [],
      source: record.source,
    },
  };
});

const validationIds = new Set(
  categories.map((category) => {
    const categoryRecords = validated
      .filter((record) => record.category === category)
      .sort((first, second) => first.id.localeCompare(second.id));
    if (categoryRecords.length < 2) {
      throw new Error(`Not enough ${category} preferences for a split`);
    }
    return categoryRecords.at(-1)!.id;
  }),
);
const train = validated.filter((record) => !validationIds.has(record.id));
const validation = validated.filter((record) => validationIds.has(record.id));

for (const [name, split] of [
  ['dpo-train', train],
  ['dpo-validation', validation],
] as const) {
  await writeFile(
    `data/preferences/${name}.jsonl`,
    `${split.map((record) => JSON.stringify(record)).join('\n')}\n`,
  );
}
await writeFile(
  'data/preferences/dpo-manifest.json',
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      sourceRecords: records.length,
      excludedLegacyRecords: allHumanRecords.length - records.length,
      excludedTiesAndRejectBoth: diagnosticReviews.length,
      train: train.length,
      validation: validation.length,
      validationIds: [...validationIds].sort(),
      trainByCategory: Object.fromEntries(
        categories.map((category) => [
          category,
          train.filter((record) => record.category === category).length,
        ]),
      ),
      validationByCategory: Object.fromEntries(
        categories.map((category) => [
          category,
          validation.filter((record) => record.category === category).length,
        ]),
      ),
    },
    null,
    2,
  ),
);

console.log(
  JSON.stringify({
    status: 'success',
    source: records.length,
    train: train.length,
    validation: validation.length,
    validationIds: [...validationIds].sort(),
  }),
);
