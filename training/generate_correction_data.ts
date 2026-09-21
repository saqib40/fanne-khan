import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {MOTION_DESIGN_SYSTEM_PROMPT} from '../backend/src/prompt';
import {
  type MotionSegment,
  type MotionSpec,
  type TextLine,
  parseMotionSpec,
} from '../frontend/src/schema/motion-spec';

type FailureClass = 'contrast' | 'metric-role' | 'line-boundary';
type Correction = {
  id: string;
  failureClass: FailureClass;
  split: 'train' | 'validation';
  prompt: string;
  spec: MotionSpec;
};

const styles = [
  {name: 'geometric coral', palette: {background: '#0b0d12', foreground: '#f6f4ef', accent: '#ff5c35', muted: '#9298a6'}, display: 'space-grotesk' as const, body: 'inter' as const},
  {name: 'editorial cobalt', palette: {background: '#f0eadf', foreground: '#171713', accent: '#2457f5', muted: '#6d6a61'}, display: 'fraunces' as const, body: 'inter' as const},
  {name: 'technical mint', palette: {background: '#071a14', foreground: '#ebfff6', accent: '#61f2ad', muted: '#7ca998'}, display: 'jetbrains-mono' as const, body: 'jetbrains-mono' as const},
  {name: 'minimal red', palette: {background: '#f5f5f2', foreground: '#111111', accent: '#d82945', muted: '#777771'}, display: 'inter' as const, body: 'inter' as const},
  {name: 'midnight violet', palette: {background: '#090816', foreground: '#ffffff', accent: '#b59aff', muted: '#aaa4c2'}, display: 'space-grotesk' as const, body: 'inter' as const},
  {name: 'warm amber', palette: {background: '#15100c', foreground: '#fff4e8', accent: '#ffb000', muted: '#bda992'}, display: 'fraunces' as const, body: 'inter' as const},
  {name: 'electric cyan', palette: {background: '#061118', foreground: '#f2fbff', accent: '#35dcff', muted: '#8196a0'}, display: 'jetbrains-mono' as const, body: 'inter' as const},
  {name: 'soft lavender', palette: {background: '#eeeafb', foreground: '#201a33', accent: '#6846c7', muted: '#726b87'}, display: 'space-grotesk' as const, body: 'inter' as const},
  {name: 'deep red editorial', palette: {background: '#21090d', foreground: '#fff1ed', accent: '#ff765f', muted: '#c69b94'}, display: 'fraunces' as const, body: 'inter' as const},
  {name: 'clean blue', palette: {background: '#f2f7ff', foreground: '#101b2e', accent: '#155eef', muted: '#62708a'}, display: 'inter' as const, body: 'inter' as const},
];

const dimensions = [
  {name: 'landscape', width: 1920 as const, height: 1080 as const},
  {name: 'square', width: 1080 as const, height: 1080 as const},
  {name: 'portrait', width: 1080 as const, height: 1920 as const},
];

const contrastTitles = [
  'Build with clarity',
  'Ideas need contrast',
  'Lead with the signal',
  'Color carries meaning',
  'Make every word visible',
  'Read the room',
  'Light finds form',
  'Design for attention',
  'Clarity moves first',
  'Let the message lead',
];
const metricValues = [
  '17%', '240K', '3.8M', '92%', '48H', '7.2X', '640', '1.4B', '56%', '12K',
];
const metricLabels = [
  'faster completion',
  'new creative sessions',
  'ideas organized',
  'members returning',
  'time saved each week',
  'more experiments shipped',
  'teams connected',
  'moments shared',
  'less material used',
  'projects completed',
];
const cities = [
  'CHENNAI', 'LUCKNOW', 'SURAT', 'INDORE', 'MYSURU',
  'BHOPAL', 'NAGPUR', 'SHILLONG', 'UDAIPUR', 'HYDERABAD',
];
const eventNames = [
  'OPEN FRAME', 'NEW CURRENTS', 'MAKING ROOM', 'TYPE NIGHT', 'AFTER IMAGE',
  'SOFT SYSTEMS', 'BRIGHT MATTER', 'COMMON THREAD', 'FIELD WORK', 'NEXT FORM',
];
const eventDescriptions = [
  'A gathering for independent makers',
  'Conversations across art and code',
  'A workshop on thoughtful practice',
  'Letters moving after dark',
  'Photography beyond the final frame',
  'Designing technology with care',
  'An exhibition of material experiments',
  'Stories from collaborative studios',
  'Learning through observation',
  'New voices in visual culture',
];

const textLine = (
  role: TextLine['role'],
  text: string,
  emphasis = false,
): TextLine => ({role, text, emphasis});

const makeSpec = ({
  id,
  name,
  index,
  kind,
  lines,
}: {
  id: string;
  name: string;
  index: number;
  kind: MotionSegment['kind'];
  lines: TextLine[];
}): MotionSpec => {
  const style = styles[index % styles.length];
  const aspect = dimensions[index % dimensions.length];
  const durationInFrames = [150, 180, 210][index % 3];
  return parseMotionSpec({
    version: '1.0',
    name,
    fps: 30,
    width: aspect.width,
    height: aspect.height,
    durationInFrames,
    palette: style.palette,
    typography: {
      display: style.display,
      body: style.body,
      tracking: [-0.05, -0.03, 0][index % 3],
      uppercaseTitles: index % 2 === 0,
    },
    accent: {
      type: ['orbit', 'grid', 'particles', 'glass', 'none'][
        index % 5
      ] as MotionSpec['accent']['type'],
      intensity: index % 5 === 4 ? 0 : 0.3,
    },
    segments: [
      {
        id,
        startFrame: 0,
        durationInFrames,
        kind,
        layout: ['left', 'center', 'split'][
          index % 3
        ] as MotionSegment['layout'],
        entrance: ['stagger', 'rise', 'wipe', 'scale', 'fade'][
          index % 5
        ] as MotionSegment['entrance'],
        exit: ['fade', 'shrink', 'cut'][index % 3] as MotionSegment['exit'],
        lines,
      },
    ],
  });
};

const corrections: Correction[] = [];
for (let index = 0; index < 50; index++) {
  const variant = Math.floor(index / 10);
  const style = styles[index % styles.length];
  const aspect = dimensions[index % dimensions.length];
  const title = contrastTitles[index % contrastTitles.length];
  const eyebrow = `COLOR PRINCIPLE ${String(variant + 1).padStart(2, '0')}`;
  const split = variant < 4 ? 'train' : 'validation';
  corrections.push({
    id: `correction-contrast-${String(index + 1).padStart(2, '0')}`,
    failureClass: 'contrast',
    split,
    prompt:
      `Create a ${aspect.name} title motion design. ` +
      `Exact copy: ${eyebrow} / ${title}. Style direction: ${style.name}; ` +
      'ensure readable foreground and accent contrast.',
    spec: makeSpec({
      id: `contrast-${index + 1}`,
      name: title,
      index,
      kind: 'title',
      lines: [
        textLine('eyebrow', eyebrow),
        textLine('title', title, true),
      ],
    }),
  });
}

for (let index = 0; index < 50; index++) {
  const variant = Math.floor(index / 10);
  const value = metricValues[index % metricValues.length];
  const label = `${metricLabels[index % metricLabels.length]} ${
    ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'][variant]
  }`;
  const aspect = dimensions[(index + 1) % dimensions.length];
  const style = styles[index % styles.length];
  const split = variant < 4 ? 'train' : 'validation';
  corrections.push({
    id: `correction-metric-${String(index + 1).padStart(2, '0')}`,
    failureClass: 'metric-role',
    split,
    prompt:
      `Create a ${aspect.name} metric motion design. ` +
      `Exact copy: ${value} / ${label}. Style direction: ${style.name}.`,
    spec: makeSpec({
      id: `metric-correction-${index + 1}`,
      name: `${value} ${label}`,
      index: index + 1,
      kind: 'metric',
      lines: [
        textLine('metric', value, true),
        textLine('subtitle', label),
      ],
    }),
  });
}

for (let index = 0; index < 50; index++) {
  const variant = Math.floor(index / 10);
  const item = index % 10;
  const date = `${12 + variant} ${['OCT', 'NOV', 'DEC', 'JAN', 'FEB'][variant]}`;
  const location = `${cities[item]} · ${date} · ${6 + (item % 6)} PM`;
  const aspect = dimensions[(index + 2) % dimensions.length];
  const style = styles[index % styles.length];
  const split = variant < 4 ? 'train' : 'validation';
  corrections.push({
    id: `correction-boundary-${String(index + 1).padStart(2, '0')}`,
    failureClass: 'line-boundary',
    split,
    prompt:
      `Create a ${aspect.name} event motion design. ` +
      `Exact copy: ${location} / ${eventNames[item]} / ${eventDescriptions[item]}. ` +
      `Style direction: ${style.name}.`,
    spec: makeSpec({
      id: `boundary-${index + 1}`,
      name: eventNames[item],
      index: index + 2,
      kind: 'event',
      lines: [
        textLine('eyebrow', location),
        textLine('title', eventNames[item], true),
        textLine('subtitle', eventDescriptions[item]),
      ],
    }),
  });
}

const toRecord = (correction: Correction) => ({
  id: correction.id,
  messages: [
    {role: 'system', content: MOTION_DESIGN_SYSTEM_PROMPT},
    {role: 'user', content: correction.prompt},
    {role: 'assistant', content: JSON.stringify(correction.spec)},
  ],
  metadata: {
    split: correction.split,
    source: 'targeted-correction',
    failureClass: correction.failureClass,
    schemaVersion: '1.0',
  },
});

const correctionTrain = corrections
  .filter((correction) => correction.split === 'train')
  .map(toRecord);
const correctionValidation = corrections
  .filter((correction) => correction.split === 'validation')
  .map(toRecord);
const canonicalTrain = (await readFile('data/sft/train.jsonl', 'utf8'))
  .trim()
  .split('\n')
  .map((row) => JSON.parse(row))
  .filter((_, index) => index % 4 === 0)
  .map((record) => ({
    ...record,
    id: `replay-${record.id}`,
    metadata: {...record.metadata, source: 'canonical-replay'},
  }));
const canonicalValidation = (await readFile('data/sft/validation.jsonl', 'utf8'))
  .trim()
  .split('\n')
  .map((row) => JSON.parse(row))
  .filter((_, index) => index % 2 === 0)
  .map((record) => ({
    ...record,
    id: `replay-${record.id}`,
    metadata: {...record.metadata, source: 'canonical-replay'},
  }));

const stageTwoTrain = [...correctionTrain, ...canonicalTrain];
const stageTwoValidation = [
  ...correctionValidation,
  ...canonicalValidation,
];
const boundaryTrain = correctionTrain.filter(
  (record) => record.metadata.failureClass === 'line-boundary',
);
const boundaryValidation = correctionValidation.filter(
  (record) => record.metadata.failureClass === 'line-boundary',
);
const stageThreeTrain = [...boundaryTrain, ...canonicalTrain.slice(0, 40)];
const stageThreeValidation = [
  ...boundaryValidation,
  ...canonicalValidation.slice(0, 10),
];
const directory = path.join('data', 'sft');
await mkdir(directory, {recursive: true});
for (const [name, records] of [
  ['corrections-train', correctionTrain],
  ['corrections-validation', correctionValidation],
  ['stage2-train', stageTwoTrain],
  ['stage2-validation', stageTwoValidation],
  ['stage3-boundary-train', stageThreeTrain],
  ['stage3-boundary-validation', stageThreeValidation],
] as const) {
  await writeFile(
    path.join(directory, `${name}.jsonl`),
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
  );
}
await writeFile(
  path.join(directory, 'stage2-manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      correctionTrain: correctionTrain.length,
      correctionValidation: correctionValidation.length,
      canonicalReplayTrain: canonicalTrain.length,
      canonicalReplayValidation: canonicalValidation.length,
      stageTwoTrain: stageTwoTrain.length,
      stageTwoValidation: stageTwoValidation.length,
      stageThreeTrain: stageThreeTrain.length,
      stageThreeValidation: stageThreeValidation.length,
      correctionClasses: Object.fromEntries(
        ['contrast', 'metric-role', 'line-boundary'].map((failureClass) => [
          failureClass,
          correctionTrain.filter(
            (record) => record.metadata.failureClass === failureClass,
          ).length,
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
    correctionTrain: correctionTrain.length,
    correctionValidation: correctionValidation.length,
    stageTwoTrain: stageTwoTrain.length,
    stageTwoValidation: stageTwoValidation.length,
    stageThreeTrain: stageThreeTrain.length,
    stageThreeValidation: stageThreeValidation.length,
  }),
);
