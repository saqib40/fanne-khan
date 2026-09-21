import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {MOTION_DESIGN_SYSTEM_PROMPT} from '../backend/src/prompt';
import {
  type MotionSegment,
  type MotionSpec,
  type TextLine,
  parseMotionSpec,
} from '../frontend/src/schema/motion-spec';

type Content = {
  id: string;
  name: string;
  kind: MotionSegment['kind'];
  lines: TextLine[];
};

type Style = {
  name: string;
  palette: MotionSpec['palette'];
  display: MotionSpec['typography']['display'];
  body: MotionSpec['typography']['body'];
  tracking: number;
  uppercaseTitles: boolean;
  layout: MotionSegment['layout'];
  entrance: MotionSegment['entrance'];
  exit: MotionSegment['exit'];
  accent: MotionSpec['accent'];
};

const line = (
  role: TextLine['role'],
  text: string,
  emphasis = false,
): TextLine => ({role, text, emphasis});

const contents: Content[] = [
  {id: 'title-shape', name: 'Shape the signal', kind: 'title', lines: [line('eyebrow', 'A CLEARER WAY FORWARD'), line('title', 'Shape the signal', true)]},
  {id: 'title-make-space', name: 'Make space for better', kind: 'title', lines: [line('title', 'Make space'), line('title', 'for better', true), line('subtitle', 'Thoughtful work needs room')]},
  {id: 'title-stay-in-motion', name: 'Stay in motion', kind: 'title', lines: [line('eyebrow', 'KEEP GOING'), line('title', 'Stay in motion', true)]},
  {id: 'title-new-rhythm', name: 'Find a new rhythm', kind: 'title', lines: [line('title', 'Find a new rhythm', true), line('subtitle', 'Change how the work feels')]},
  {id: 'title-hold-the-line', name: 'Hold the line', kind: 'title', lines: [line('eyebrow', 'WHEN IT MATTERS'), line('title', 'Hold the line', true)]},
  {id: 'title-see-differently', name: 'See it differently', kind: 'title', lines: [line('title', 'See it'), line('title', 'differently', true)]},
  {id: 'title-work-visible', name: 'Make the work visible', kind: 'title', lines: [line('eyebrow', 'FROM THOUGHT TO FORM'), line('title', 'Make the work visible', true)]},
  {id: 'title-begin-again', name: 'Begin again', kind: 'title', lines: [line('title', 'Begin again', true), line('subtitle', 'Every draft opens a door')]},
  {id: 'title-useful-beautiful', name: 'Useful can be beautiful', kind: 'title', lines: [line('title', 'Useful can be'), line('title', 'beautiful', true)]},
  {id: 'title-quiet-confidence', name: 'Move with quiet confidence', kind: 'title', lines: [line('eyebrow', 'NO NEED TO SHOUT'), line('title', 'Move with quiet confidence', true)]},

  {id: 'quote-practice', name: 'Practice makes possibility', kind: 'quote', lines: [line('title', 'Practice makes'), line('title', 'possibility', true), line('body', 'Studio Journal')]},
  {id: 'quote-attention', name: 'Attention changes the outcome', kind: 'quote', lines: [line('title', 'Attention changes'), line('title', 'the outcome', true)]},
  {id: 'quote-small-decisions', name: 'Small decisions become direction', kind: 'quote', lines: [line('title', 'Small decisions'), line('title', 'become direction', true)]},
  {id: 'quote-listen', name: 'Listen before you add', kind: 'quote', lines: [line('eyebrow', 'A CREATIVE PRINCIPLE'), line('title', 'Listen before you add', true)]},
  {id: 'quote-simple', name: 'Simple takes courage', kind: 'quote', lines: [line('title', 'Simple takes courage', true), line('body', 'Notes on making')]},
  {id: 'quote-draft', name: 'The draft teaches the maker', kind: 'quote', lines: [line('title', 'The draft teaches'), line('title', 'the maker', true)]},
  {id: 'quote-questions', name: 'Better questions make better work', kind: 'quote', lines: [line('title', 'Better questions'), line('title', 'make better work', true)]},
  {id: 'quote-time', name: 'Give the idea time', kind: 'quote', lines: [line('eyebrow', 'A REMINDER'), line('title', 'Give the idea time', true)]},
  {id: 'quote-care', name: 'Care is visible in the details', kind: 'quote', lines: [line('title', 'Care is visible'), line('title', 'in the details', true)]},
  {id: 'quote-finish', name: 'Finished creates the next beginning', kind: 'quote', lines: [line('title', 'Finished creates'), line('title', 'the next beginning', true)]},

  {id: 'product-lumen', name: 'Lumen launch', kind: 'product', lines: [line('eyebrow', 'INTRODUCING LUMEN'), line('title', 'Bring every thought into focus', true), line('subtitle', 'Available today')]},
  {id: 'product-tide', name: 'Tide launch', kind: 'product', lines: [line('eyebrow', 'MEET TIDE'), line('title', 'Plan less'), line('title', 'flow more', true)]},
  {id: 'product-orbit', name: 'Orbit launch', kind: 'product', lines: [line('eyebrow', 'ORBIT 2'), line('title', 'Your team in sync', true), line('subtitle', 'One shared rhythm')]},
  {id: 'product-field', name: 'Field launch', kind: 'product', lines: [line('eyebrow', 'FIELD NOTES'), line('title', 'Capture what matters', true), line('subtitle', 'Nothing leaves your device')]},
  {id: 'product-sola', name: 'Sola launch', kind: 'product', lines: [line('eyebrow', 'NEW FROM SOLA'), line('title', 'Light for every hour', true)]},
  {id: 'product-morrow', name: 'Morrow launch', kind: 'product', lines: [line('eyebrow', 'MORROW'), line('title', 'Wake up to calmer mornings', true)]},
  {id: 'product-kindred', name: 'Kindred launch', kind: 'product', lines: [line('eyebrow', 'KINDRED'), line('title', 'Keep good people close', true), line('subtitle', 'Private circles, made simple')]},
  {id: 'product-canvas', name: 'Canvas launch', kind: 'product', lines: [line('eyebrow', 'CANVAS'), line('title', 'Present the whole picture', true)]},
  {id: 'product-thread', name: 'Thread launch', kind: 'product', lines: [line('eyebrow', 'THREAD'), line('title', 'Every decision connected', true), line('subtitle', 'Built for thoughtful teams')]},
  {id: 'product-spark', name: 'Spark launch', kind: 'product', lines: [line('eyebrow', 'SPARK MINI'), line('title', 'Small device'), line('title', 'serious ideas', true)]},

  {id: 'metric-hours', name: 'Hours returned', kind: 'metric', lines: [line('eyebrow', 'THIS MONTH'), line('metric', '320H', true), line('subtitle', 'returned to creative work')]},
  {id: 'metric-response', name: 'Response improvement', kind: 'metric', lines: [line('eyebrow', 'MEDIAN RESPONSE'), line('metric', '42%', true), line('subtitle', 'faster for every customer')]},
  {id: 'metric-community', name: 'Community milestone', kind: 'metric', lines: [line('metric', '850K', true), line('subtitle', 'people building together')]},
  {id: 'metric-waste', name: 'Waste reduction', kind: 'metric', lines: [line('eyebrow', 'SINCE JANUARY'), line('metric', '-31%', true), line('subtitle', 'less material waste')]},
  {id: 'metric-score', name: 'Satisfaction score', kind: 'metric', lines: [line('metric', '9.6', true), line('subtitle', 'average creator rating')]},
  {id: 'metric-countries', name: 'Global reach', kind: 'metric', lines: [line('metric', '74', true), line('subtitle', 'countries represented')]},
  {id: 'metric-projects', name: 'Projects shipped', kind: 'metric', lines: [line('eyebrow', 'LAST QUARTER'), line('metric', '18.2K', true), line('subtitle', 'projects shipped')]},
  {id: 'metric-energy', name: 'Energy saved', kind: 'metric', lines: [line('metric', '1.8GW', true), line('subtitle', 'clean energy generated')]},
  {id: 'metric-retention', name: 'Member retention', kind: 'metric', lines: [line('eyebrow', 'ONE YEAR LATER'), line('metric', '93%', true), line('subtitle', 'still creating')]},
  {id: 'metric-distance', name: 'Distance explored', kind: 'metric', lines: [line('metric', '6.4M KM', true), line('subtitle', 'explored this season')]},

  {id: 'event-form', name: 'Form festival', kind: 'event', lines: [line('eyebrow', 'MUMBAI · 12 DEC'), line('title', 'FORM FESTIVAL', true), line('subtitle', 'Doors open at 7 PM')]},
  {id: 'event-layers', name: 'Layers workshop', kind: 'event', lines: [line('eyebrow', 'SATURDAY · 11 AM'), line('title', 'LAYERS', true), line('subtitle', 'A workshop for visual thinkers')]},
  {id: 'event-common-ground', name: 'Common Ground', kind: 'event', lines: [line('eyebrow', 'DELHI · 4 NOV'), line('title', 'COMMON GROUND', true), line('subtitle', 'Designing public futures')]},
  {id: 'event-night-school', name: 'Night School', kind: 'event', lines: [line('eyebrow', 'THURSDAY · 8 PM'), line('title', 'NIGHT SCHOOL', true), line('subtitle', 'Learning after hours')]},
  {id: 'event-material', name: 'Material Matters', kind: 'event', lines: [line('eyebrow', 'PUNE · 18 JAN'), line('title', 'MATERIAL MATTERS', true), line('subtitle', 'An exhibition in three rooms')]},
  {id: 'event-sideways', name: 'Sideways conference', kind: 'event', lines: [line('eyebrow', 'GOA · 22 FEB'), line('title', 'SIDEWAYS', true), line('subtitle', 'New paths through old problems')]},
  {id: 'event-open-studio', name: 'Open Studio', kind: 'event', lines: [line('eyebrow', 'SUNDAY · 2 PM'), line('title', 'OPEN STUDIO', true), line('subtitle', 'Come see what is taking shape')]},
  {id: 'event-sound-color', name: 'Sound and Color', kind: 'event', lines: [line('eyebrow', 'KOCHI · 30 MAR'), line('title', 'SOUND + COLOR', true), line('subtitle', 'One night, two disciplines')]},
  {id: 'event-assembly', name: 'Assembly', kind: 'event', lines: [line('eyebrow', 'ONLINE · 5 PM IST'), line('title', 'ASSEMBLY', true), line('subtitle', 'Independent makers in conversation')]},
  {id: 'event-first-light', name: 'First Light', kind: 'event', lines: [line('eyebrow', 'JAIPUR · 6 AM'), line('title', 'FIRST LIGHT', true), line('subtitle', 'A sunrise photography walk')]},

  {id: 'outro-elsewhere', name: 'Elsewhere outro', kind: 'outro', lines: [line('title', 'ELSEWHERE', true), line('eyebrow', 'GO FIND IT')]},
  {id: 'outro-slow', name: 'Slow Studio outro', kind: 'outro', lines: [line('title', 'SLOW STUDIO', true), line('eyebrow', 'MADE WITH TIME')]},
  {id: 'outro-hinterland', name: 'Hinterland outro', kind: 'outro', lines: [line('title', 'HINTERLAND', true), line('eyebrow', 'FURTHER BY DESIGN')]},
  {id: 'outro-sunday', name: 'Sunday Press outro', kind: 'outro', lines: [line('title', 'SUNDAY PRESS', true), line('eyebrow', 'WORDS WORTH KEEPING')]},
  {id: 'outro-grain', name: 'Grain outro', kind: 'outro', lines: [line('title', 'GRAIN', true), line('eyebrow', 'MATERIAL STORIES')]},
  {id: 'outro-tandem', name: 'Tandem outro', kind: 'outro', lines: [line('title', 'TANDEM', true), line('eyebrow', 'BETTER TOGETHER')]},
  {id: 'outro-bower', name: 'Bower outro', kind: 'outro', lines: [line('title', 'BOWER', true), line('eyebrow', 'ROOM TO GROW')]},
  {id: 'outro-margin', name: 'Margin outro', kind: 'outro', lines: [line('title', 'MARGIN', true), line('eyebrow', 'SPACE FOR THOUGHT')]},
  {id: 'outro-twelve', name: 'Twelve outro', kind: 'outro', lines: [line('title', 'TWELVE', true), line('eyebrow', 'MAKE THE HOURS COUNT')]},
  {id: 'outro-petal', name: 'Petal outro', kind: 'outro', lines: [line('title', 'PETAL', true), line('eyebrow', 'GROW GENTLY')]},
];

const styles: Style[] = [
  {name: 'geometric coral', palette: {background: '#0b0d12', foreground: '#f6f4ef', accent: '#ff5c35', muted: '#9298a6'}, display: 'space-grotesk', body: 'inter', tracking: -0.04, uppercaseTitles: false, layout: 'left', entrance: 'stagger', exit: 'fade', accent: {type: 'orbit', intensity: 0.45}},
  {name: 'editorial cobalt', palette: {background: '#f0eadf', foreground: '#171713', accent: '#2457f5', muted: '#6d6a61'}, display: 'fraunces', body: 'inter', tracking: -0.03, uppercaseTitles: false, layout: 'center', entrance: 'wipe', exit: 'shrink', accent: {type: 'grid', intensity: 0.25}},
  {name: 'technical mint', palette: {background: '#071a14', foreground: '#ebfff6', accent: '#61f2ad', muted: '#7ca998'}, display: 'jetbrains-mono', body: 'jetbrains-mono', tracking: -0.03, uppercaseTitles: true, layout: 'left', entrance: 'scale', exit: 'fade', accent: {type: 'particles', intensity: 0.35}},
  {name: 'minimal monochrome', palette: {background: '#f5f5f2', foreground: '#111111', accent: '#d82945', muted: '#777771'}, display: 'inter', body: 'inter', tracking: -0.05, uppercaseTitles: true, layout: 'center', entrance: 'fade', exit: 'fade', accent: {type: 'none', intensity: 0}},
  {name: 'midnight violet', palette: {background: '#090816', foreground: '#ffffff', accent: '#b59aff', muted: '#aaa4c2'}, display: 'space-grotesk', body: 'inter', tracking: -0.05, uppercaseTitles: false, layout: 'split', entrance: 'rise', exit: 'fade', accent: {type: 'glass', intensity: 0.5}},
  {name: 'warm amber', palette: {background: '#15100c', foreground: '#fff4e8', accent: '#ffb000', muted: '#bda992'}, display: 'fraunces', body: 'inter', tracking: -0.02, uppercaseTitles: false, layout: 'center', entrance: 'stagger', exit: 'shrink', accent: {type: 'orbit', intensity: 0.3}},
  {name: 'electric cyan', palette: {background: '#061118', foreground: '#f2fbff', accent: '#35dcff', muted: '#8196a0'}, display: 'jetbrains-mono', body: 'inter', tracking: 0, uppercaseTitles: true, layout: 'left', entrance: 'wipe', exit: 'cut', accent: {type: 'grid', intensity: 0.5}},
  {name: 'soft lavender', palette: {background: '#eeeafb', foreground: '#201a33', accent: '#6846c7', muted: '#726b87'}, display: 'space-grotesk', body: 'inter', tracking: -0.04, uppercaseTitles: false, layout: 'center', entrance: 'scale', exit: 'fade', accent: {type: 'particles', intensity: 0.25}},
  {name: 'deep red editorial', palette: {background: '#21090d', foreground: '#fff1ed', accent: '#ff765f', muted: '#c69b94'}, display: 'fraunces', body: 'inter', tracking: -0.03, uppercaseTitles: false, layout: 'split', entrance: 'rise', exit: 'shrink', accent: {type: 'glass', intensity: 0.35}},
  {name: 'clean blue', palette: {background: '#f2f7ff', foreground: '#101b2e', accent: '#155eef', muted: '#62708a'}, display: 'inter', body: 'inter', tracking: -0.04, uppercaseTitles: true, layout: 'left', entrance: 'stagger', exit: 'fade', accent: {type: 'none', intensity: 0}},
];

const aspects = [
  {name: 'landscape', width: 1920 as const, height: 1080 as const},
  {name: 'square', width: 1080 as const, height: 1080 as const},
  {name: 'portrait', width: 1080 as const, height: 1920 as const},
];

const benchmarkPrompts = new Set(
  (
    JSON.parse(
      await readFile(
        path.join('data', 'benchmarks', 'baseline-prompts.json'),
        'utf8',
      ),
    ) as Array<{prompt: string}>
  ).map((record) => record.prompt.trim().toLowerCase()),
);

const splits = {
  train: [] as unknown[],
  validation: [] as unknown[],
  test: [] as unknown[],
};

for (const [contentIndex, content] of contents.entries()) {
  const positionWithinKind = contentIndex % 10;
  const split =
    positionWithinKind < 8
      ? 'train'
      : positionWithinKind === 8
        ? 'validation'
        : 'test';

  for (const [styleIndex, style] of styles.entries()) {
    const aspect = aspects[(contentIndex + styleIndex) % aspects.length];
    const durationInFrames = [150, 180, 210][styleIndex % 3];
    const spec = parseMotionSpec({
      version: '1.0',
      name: content.name,
      fps: 30,
      width: aspect.width,
      height: aspect.height,
      durationInFrames,
      palette: style.palette,
      typography: {
        display: style.display,
        body: style.body,
        tracking: style.tracking,
        uppercaseTitles: style.uppercaseTitles,
      },
      accent: style.accent,
      segments: [
        {
          id: content.id,
          startFrame: 0,
          durationInFrames,
          kind: content.kind,
          layout: style.layout,
          entrance: style.entrance,
          exit: style.exit,
          lines: content.lines,
        },
      ],
    });
    const exactCopy = content.lines.map((item) => item.text).join(' / ');
    const prompt =
      `Create a ${aspect.name} ${content.kind} motion design. ` +
      `Exact copy: ${exactCopy}. Style direction: ${style.name}.`;
    if (benchmarkPrompts.has(prompt.trim().toLowerCase())) {
      throw new Error(`Benchmark leakage detected for ${content.id}`);
    }
    splits[split].push({
      id: `${content.id}-${String(styleIndex + 1).padStart(2, '0')}`,
      messages: [
        {role: 'system', content: MOTION_DESIGN_SYSTEM_PROMPT},
        {role: 'user', content: prompt},
        {role: 'assistant', content: JSON.stringify(spec)},
      ],
      metadata: {
        split,
        contentId: content.id,
        kind: content.kind,
        style: style.name,
        aspect: aspect.name,
        schemaVersion: spec.version,
      },
    });
  }
}

const outputDirectory = path.join('data', 'sft');
await mkdir(outputDirectory, {recursive: true});
for (const [split, records] of Object.entries(splits)) {
  await writeFile(
    path.join(outputDirectory, `${split}.jsonl`),
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
  );
}
await writeFile(
  path.join(outputDirectory, 'manifest.json'),
  JSON.stringify(
    {
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      splitStrategy: 'content-disjoint within every scene kind',
      counts: Object.fromEntries(
        Object.entries(splits).map(([split, records]) => [
          split,
          records.length,
        ]),
      ),
      total: Object.values(splits).reduce(
        (total, records) => total + records.length,
        0,
      ),
      styles: styles.map((style) => style.name),
      kinds: [...new Set(contents.map((content) => content.kind))],
    },
    null,
    2,
  ),
);

console.log(
  JSON.stringify({
    status: 'success',
    counts: Object.fromEntries(
      Object.entries(splits).map(([split, records]) => [split, records.length]),
    ),
  }),
);
