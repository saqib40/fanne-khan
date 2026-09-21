import {mkdir, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {
  ensureBrowser,
  renderStill,
  selectComposition,
  type OpenGlRenderer,
} from '@remotion/renderer';
import sharp from 'sharp';
import {fixtures, type FixtureId} from '../../frontend/src/fixtures';
import {
  contrastRatio,
  type MotionSpec,
  parseMotionSpec,
} from '../../frontend/src/schema/motion-spec';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const localLibraryDirectory = path.join(
  root,
  '.cache',
  'system-libs',
  'usr',
  'lib',
  'x86_64-linux-gnu',
);
process.env.LD_LIBRARY_PATH = [
  localLibraryDirectory,
  process.env.LD_LIBRARY_PATH,
]
  .filter(Boolean)
  .join(':');
const requestedCompositionId = (process.env.COMPOSITION_ID ??
  'ProductLaunch') as FixtureId;
const specPath = process.env.SPEC_PATH;
const compositionId = specPath ? 'Generated' : requestedCompositionId;
const requestedGl = (process.env.REMOTION_GL ?? 'angle') as OpenGlRenderer;
const sampleCount = 12;

if (!specPath && !(requestedCompositionId in fixtures)) {
  throw new Error(
    `Unknown composition "${requestedCompositionId}". Choose: ${Object.keys(fixtures).join(', ')}`,
  );
}

const pixelDifference = async (
  firstPath: string,
  secondPath: string,
): Promise<number> => {
  const [first, second] = await Promise.all([
    sharp(firstPath).removeAlpha().raw().toBuffer({resolveWithObject: true}),
    sharp(secondPath).removeAlpha().raw().toBuffer({resolveWithObject: true}),
  ]);

  if (
    first.info.width !== second.info.width ||
    first.info.height !== second.info.height ||
    first.info.channels !== second.info.channels
  ) {
    throw new Error('Rendered samples have inconsistent dimensions');
  }

  let absoluteDifference = 0;
  for (let index = 0; index < first.data.length; index++) {
    absoluteDifference += Math.abs(first.data[index] - second.data[index]);
  }
  return absoluteDifference / first.data.length / 255;
};

const standardDeviation = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
};

const main = async () => {
  const startedAt = performance.now();
  const spec: MotionSpec = specPath
    ? parseMotionSpec(JSON.parse(await readFile(specPath, 'utf8')))
    : fixtures[requestedCompositionId];
  const outputName = specPath
    ? spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    : requestedCompositionId;
  const outputDirectory = path.join(root, '.cache', 'evaluator', outputName);
  await rm(outputDirectory, {recursive: true, force: true});
  await mkdir(outputDirectory, {recursive: true});

  await ensureBrowser();
  const serveUrl = await bundle({
    entryPoint: path.join(root, 'frontend', 'src', 'index.ts'),
    webpackOverride: (configuration) => configuration,
  });
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps: {spec},
    chromiumOptions: {gl: requestedGl},
  });

  const frames = Array.from({length: sampleCount}, (_, index) =>
    Math.round((index * (composition.durationInFrames - 1)) / (sampleCount - 1)),
  );
  const scale = Math.min(1, 512 / composition.width, 288 / composition.height);
  const files: string[] = [];

  for (const frame of frames) {
    const output = path.join(
      outputDirectory,
      `${compositionId}-${String(frame).padStart(4, '0')}.png`,
    );
    await renderStill({
      composition,
      serveUrl,
      frame,
      imageFormat: 'png',
      output,
      scale,
      inputProps: {spec},
      chromiumOptions: {gl: requestedGl},
    });
    files.push(output);
  }

  const deltas: number[] = [];
  for (let index = 1; index < files.length; index++) {
    deltas.push(await pixelDifference(files[index - 1], files[index]));
  }

  const foregroundContrast = contrastRatio(
    spec.palette.foreground,
    spec.palette.background,
  );
  const accentContrast = contrastRatio(
    spec.palette.accent,
    spec.palette.background,
  );
  const shortestExposure = Math.min(
    ...spec.segments.map((segment) => segment.durationInFrames / spec.fps),
  );
  const meanMotion =
    deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  const peakMotion = Math.max(...deltas);
  const activeSamplePairs = deltas.filter((value) => value >= 0.001).length;
  const report = {
    status: 'success',
    compositionId,
    renderer: requestedGl,
    samples: frames.length,
    dimensions: {
      source: [composition.width, composition.height],
      sampled: [
        Math.round(composition.width * scale),
        Math.round(composition.height * scale),
      ],
    },
    hardGates: {
      foregroundContrast: {
        value: Number(foregroundContrast.toFixed(2)),
        pass: foregroundContrast >= 4.5,
      },
      accentContrast: {
        value: Number(accentContrast.toFixed(2)),
        pass: accentContrast >= 3,
      },
      readableDuration: {
        seconds: Number(shortestExposure.toFixed(2)),
        pass: shortestExposure >= 1.5,
      },
      motionPresent: {
        peak: Number(peakMotion.toFixed(5)),
        activeSamplePairs,
        pass: peakMotion >= 0.005 && activeSamplePairs >= 2,
      },
    },
    temporal: {
      adjacentFrameDeltas: deltas.map((value) => Number(value.toFixed(5))),
      meanMotion: Number(meanMotion.toFixed(5)),
      peakMotion: Number(peakMotion.toFixed(5)),
      activeSamplePairs,
      variation: Number(standardDeviation(deltas).toFixed(5)),
    },
    elapsedSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(2)),
    outputDirectory,
  };

  console.log(JSON.stringify(report, null, 2));
  if (Object.values(report.hardGates).some((gate) => !gate.pass)) {
    process.exitCode = 2;
  }
};

void main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error: unknown) => {
    console.error(
      JSON.stringify(
        {
          status: 'failure',
          compositionId,
          renderer: requestedGl,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  });
