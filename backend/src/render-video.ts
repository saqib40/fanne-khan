import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {
  ensureBrowser,
  openBrowser,
  renderMedia,
  selectComposition,
  type OpenGlRenderer,
} from '@remotion/renderer';
import {z} from 'zod';
import type {MotionSpec} from '../../frontend/src/schema/motion-spec';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const localLibraryDirectory = path.join(
  root,
  '.cache/system-libs/usr/lib/x86_64-linux-gnu',
);
process.env.LD_LIBRARY_PATH = [
  localLibraryDirectory,
  process.env.LD_LIBRARY_PATH,
]
  .filter(Boolean)
  .join(':');

const requestedGl = (process.env.REMOTION_GL ?? 'angle') as OpenGlRenderer;
const renderScale = z.coerce
  .number()
  .min(0.25)
  .max(1)
  .parse(process.env.DEMO_RENDER_SCALE ?? 2 / 3);

const createRuntime = async () => {
  await ensureBrowser();
  const serveUrl = await bundle({
    entryPoint: path.join(root, 'frontend/src/index.ts'),
    webpackOverride: (configuration) => configuration,
  });
  const browser = await openBrowser('chrome', {
    chromiumOptions: {gl: requestedGl},
    logLevel: 'warn',
  });
  return {serveUrl, browser};
};
let runtime: ReturnType<typeof createRuntime> | undefined;
const getRuntime = () => (runtime ??= createRuntime());

export const generatedVideoDirectory = path.join(root, 'out/generated');

export const closeVideoRenderer = async (): Promise<void> => {
  if (!runtime) return;
  const {browser} = await runtime;
  await browser.close({silent: true});
  runtime = undefined;
};

export const renderMotionSpecToMp4 = async ({
  spec,
  outputPath,
}: {
  spec: MotionSpec;
  outputPath: string;
}): Promise<{
  elapsedSeconds: number;
  renderer: OpenGlRenderer;
  scale: number;
}> => {
  const startedAt = performance.now();
  await mkdir(path.dirname(outputPath), {recursive: true});
  const {serveUrl, browser} = await getRuntime();
  const inputProps = {spec};
  const composition = await selectComposition({
    serveUrl,
    id: 'Generated',
    inputProps,
    chromiumOptions: {gl: requestedGl},
    puppeteerInstance: browser,
  });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    chromiumOptions: {gl: requestedGl},
    puppeteerInstance: browser,
    concurrency: 1,
    scale: renderScale,
    crf: 20,
    imageFormat: 'jpeg',
    jpegQuality: 85,
    pixelFormat: 'yuv420p',
    overwrite: true,
    logLevel: 'warn',
  });
  return {
    elapsedSeconds: Number(
      ((performance.now() - startedAt) / 1000).toFixed(2),
    ),
    renderer: requestedGl,
    scale: renderScale,
  };
};
