import {readFile} from 'node:fs/promises';
import {validateContentPolicy} from '../backend/src/ollama';
import {parseMotionSpec} from '../frontend/src/schema/motion-spec';

type RecordShape = {
  id: string;
  messages: Array<{role: string; content: string}>;
  metadata: {
    source: 'targeted-correction' | 'canonical-replay';
    failureClass?: 'contrast' | 'metric-role' | 'line-boundary';
  };
};

const readJsonl = async (name: string): Promise<RecordShape[]> =>
  (await readFile(`data/sft/${name}.jsonl`, 'utf8'))
    .trim()
    .split('\n')
    .map((row) => JSON.parse(row) as RecordShape);

const correctionTrain = await readJsonl('corrections-train');
const correctionValidation = await readJsonl('corrections-validation');
const stageTwoTrain = await readJsonl('stage2-train');
const stageTwoValidation = await readJsonl('stage2-validation');
const stageThreeTrain = await readJsonl('stage3-boundary-train');
const stageThreeValidation = await readJsonl('stage3-boundary-validation');

for (const record of [...correctionTrain, ...correctionValidation]) {
  const user = record.messages.find((message) => message.role === 'user');
  const assistant = record.messages.find(
    (message) => message.role === 'assistant',
  );
  if (!user || !assistant || !record.metadata.failureClass) {
    throw new Error(`${record.id} is missing required correction fields`);
  }
  const spec = parseMotionSpec(JSON.parse(assistant.content));
  const issues = validateContentPolicy({request: user.content, value: spec});
  if (issues.length > 0) {
    throw new Error(`${record.id}: ${issues.join('; ')}`);
  }
  if (record.metadata.failureClass === 'metric-role') {
    const metricLines = spec.segments.flatMap((segment) =>
      segment.lines.filter((line) => line.role === 'metric'),
    );
    if (metricLines.length !== 1 || !/\d/.test(metricLines[0].text)) {
      throw new Error(`${record.id} does not have one numeric metric role`);
    }
  }
}

const trainCorrectionIds = new Set(
  correctionTrain.map((record) => record.id),
);
const validationCorrectionIds = new Set(
  correctionValidation.map((record) => record.id),
);
const overlap = [...trainCorrectionIds].filter((id) =>
  validationCorrectionIds.has(id),
);
if (overlap.length > 0) {
  throw new Error(`Correction split overlap: ${overlap.join(', ')}`);
}
if (
  stageTwoTrain.filter(
    (record) => record.metadata.source === 'targeted-correction',
  ).length !== correctionTrain.length ||
  stageTwoValidation.filter(
    (record) => record.metadata.source === 'targeted-correction',
  ).length !== correctionValidation.length
) {
  throw new Error('Stage-two mix does not contain all corrections');
}

const countClasses = (records: RecordShape[]) =>
  Object.fromEntries(
    ['contrast', 'metric-role', 'line-boundary'].map((failureClass) => [
      failureClass,
      records.filter(
        (record) => record.metadata.failureClass === failureClass,
      ).length,
    ]),
  );

console.log(
  JSON.stringify(
    {
      status: 'success',
      corrections: {
        train: correctionTrain.length,
        validation: correctionValidation.length,
        trainByClass: countClasses(correctionTrain),
        validationByClass: countClasses(correctionValidation),
      },
      stageTwo: {
        train: stageTwoTrain.length,
        validation: stageTwoValidation.length,
        trainReplay: stageTwoTrain.filter(
          (record) => record.metadata.source === 'canonical-replay',
        ).length,
        validationReplay: stageTwoValidation.filter(
          (record) => record.metadata.source === 'canonical-replay',
        ).length,
      },
      stageThree: {
        train: stageThreeTrain.length,
        validation: stageThreeValidation.length,
        trainCorrections: stageThreeTrain.filter(
          (record) => record.metadata.source === 'targeted-correction',
        ).length,
        validationCorrections: stageThreeValidation.filter(
          (record) => record.metadata.source === 'targeted-correction',
        ).length,
      },
    },
    null,
    2,
  ),
);
