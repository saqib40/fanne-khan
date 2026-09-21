import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {MOTION_DESIGN_SYSTEM_PROMPT} from '../backend/src/prompt';
import {parseMotionSpec} from '../frontend/src/schema/motion-spec';

const recordSchema = z.strictObject({
  id: z.string(),
  messages: z.tuple([
    z.strictObject({role: z.literal('system'), content: z.string()}),
    z.strictObject({role: z.literal('user'), content: z.string()}),
    z.strictObject({role: z.literal('assistant'), content: z.string()}),
  ]),
  metadata: z.strictObject({
    split: z.enum(['train', 'validation', 'test']),
    contentId: z.string(),
    kind: z.enum(['title', 'quote', 'product', 'metric', 'event', 'outro']),
    style: z.string(),
    aspect: z.enum(['landscape', 'square', 'portrait']),
    schemaVersion: z.literal('1.0'),
  }),
});

const splitNames = ['train', 'validation', 'test'] as const;
const ids = new Set<string>();
const contentBySplit = new Map<string, Set<string>>();
const report: Record<string, unknown> = {};

for (const split of splitNames) {
  const file = path.join('data', 'sft', `${split}.jsonl`);
  const rows = (await readFile(file, 'utf8'))
    .trim()
    .split('\n')
    .map((row) => recordSchema.parse(JSON.parse(row)));
  const contentIds = new Set<string>();
  const kinds: Record<string, number> = {};
  const styles = new Set<string>();
  const aspects = new Set<string>();

  for (const row of rows) {
    if (row.metadata.split !== split) {
      throw new Error(`${row.id} has incorrect split metadata`);
    }
    if (ids.has(row.id)) {
      throw new Error(`Duplicate example id: ${row.id}`);
    }
    ids.add(row.id);
    if (row.messages[0].content !== MOTION_DESIGN_SYSTEM_PROMPT) {
      throw new Error(`${row.id} uses a different system prompt`);
    }
    const spec = parseMotionSpec(JSON.parse(row.messages[2].content));
    if (spec.version !== row.metadata.schemaVersion) {
      throw new Error(`${row.id} schema metadata mismatch`);
    }
    if (spec.segments[0].kind !== row.metadata.kind) {
      throw new Error(`${row.id} kind metadata mismatch`);
    }
    contentIds.add(row.metadata.contentId);
    kinds[row.metadata.kind] = (kinds[row.metadata.kind] ?? 0) + 1;
    styles.add(row.metadata.style);
    aspects.add(row.metadata.aspect);
  }

  contentBySplit.set(split, contentIds);
  report[split] = {
    records: rows.length,
    uniqueContent: contentIds.size,
    kinds,
    styles: styles.size,
    aspects: [...aspects].sort(),
  };
}

for (let first = 0; first < splitNames.length; first++) {
  for (let second = first + 1; second < splitNames.length; second++) {
    const left = contentBySplit.get(splitNames[first]) ?? new Set();
    const right = contentBySplit.get(splitNames[second]) ?? new Set();
    const overlap = [...left].filter((contentId) => right.has(contentId));
    if (overlap.length > 0) {
      throw new Error(
        `Content leakage between ${splitNames[first]} and ${splitNames[second]}: ${overlap.join(', ')}`,
      );
    }
  }
}

console.log(JSON.stringify({status: 'success', ...report}, null, 2));
