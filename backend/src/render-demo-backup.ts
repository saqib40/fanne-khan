import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {motionSpecSchema} from '../../frontend/src/schema/motion-spec';
import {
  closeVideoRenderer,
  renderMotionSpecToMp4,
} from './render-video';

const reportSchema = z.object({
  records: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      prompt: z.string(),
      winner: z
        .object({
          spec: motionSpecSchema,
          score: z.number(),
        })
        .nullable(),
    }),
  ),
});

const root = process.cwd();
const report = reportSchema.parse(
  JSON.parse(
    await readFile(
      path.join(root, 'data/results/final-dpo-latest.json'),
      'utf8',
    ),
  ),
);
const hero = report.records
  .filter(
    (
      record,
    ): record is typeof record & {
      winner: NonNullable<typeof record.winner>;
    } => record.winner !== null,
  )
  .sort(
    (first, second) => second.winner.score - first.winner.score,
  )[0];
if (!hero) {
  throw new Error('The final benchmark contains no successful hero candidate');
}

const outputPath = path.join(root, 'out/demo-backup.mp4');
const render = await renderMotionSpecToMp4({
  spec: hero.winner.spec,
  outputPath,
});
const manifest = {
  createdAt: new Date().toISOString(),
  source: 'data/results/final-dpo-latest.json',
  benchmarkId: hero.id,
  category: hero.category,
  prompt: hero.prompt,
  score: hero.winner.score,
  spec: hero.winner.spec,
  video: 'out/demo-backup.mp4',
  render,
};
await writeFile(
  path.join(root, 'out/demo-backup.json'),
  JSON.stringify(manifest, null, 2),
);
await closeVideoRenderer();
console.log(JSON.stringify(manifest, null, 2));
