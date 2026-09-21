import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const pairDirectory = 'data/preferences/comparison-pairs';
const reviewsPath = 'data/preferences/comparison-reviews.jsonl';
const outputPath = 'data/preferences/comparison-summary.json';

const files = (await readdir(pairDirectory))
  .filter((file) => file.endsWith('.json'))
  .sort();
const manifests = new Map(
  await Promise.all(
    files.map(async (file) => {
      const manifest = JSON.parse(
        await readFile(path.join(pairDirectory, file), 'utf8'),
      ) as {
        id: string;
        category: string;
        candidates: Record<
          'A' | 'B',
          {generation: {model: 'sft' | 'dpo'}}
        >;
      };
      return [manifest.id, manifest] as const;
    }),
  ),
);
let reviewText = '';
try {
  reviewText = await readFile(reviewsPath, 'utf8');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const reviews = reviewText
  .split('\n')
  .filter(Boolean)
  .map(
    (line) =>
      JSON.parse(line) as {
        pairId: string;
        choice: 'A' | 'B' | 'tie' | 'reject-both';
      },
  );

const outcome = {sft: 0, dpo: 0, tie: 0, rejectBoth: 0};
const byCategory: Record<
  string,
  {sft: number; dpo: number; tie: number; rejectBoth: number}
> = {};
for (const review of reviews) {
  const manifest = manifests.get(review.pairId);
  if (!manifest) {
    throw new Error(`Missing manifest for ${review.pairId}`);
  }
  const category = (byCategory[manifest.category] ??= {
    sft: 0,
    dpo: 0,
    tie: 0,
    rejectBoth: 0,
  });
  if (review.choice === 'tie') {
    outcome.tie++;
    category.tie++;
  } else if (review.choice === 'reject-both') {
    outcome.rejectBoth++;
    category.rejectBoth++;
  } else {
    const winner = manifest.candidates[review.choice].generation.model;
    outcome[winner]++;
    category[winner]++;
  }
}

const decisive = outcome.sft + outcome.dpo;
const summary = {
  generated: manifests.size,
  reviewed: reviews.length,
  remaining: manifests.size - reviews.length,
  outcome,
  dpoWinRate:
    decisive === 0 ? null : Number((outcome.dpo / decisive).toFixed(3)),
  byCategory,
  recommendation:
    reviews.length < manifests.size
      ? 'Finish the blinded review before choosing an adapter.'
      : outcome.dpo > outcome.sft
        ? 'Integrate the DPO adapter, while retaining correctness gates.'
        : 'Keep the stage-three SFT adapter; DPO did not win this comparison.',
};
await writeFile(outputPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
