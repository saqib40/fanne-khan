import {createReadStream} from 'node:fs';
import {readdir, rm, stat} from 'node:fs/promises';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import path from 'node:path';
import {z} from 'zod';
import {demoPage} from './demo-page';
import {generateBestMotion} from './generate';
import {checkModelRuntime} from './ollama';
import {
  generatedVideoDirectory,
  renderMotionSpecToMp4,
} from './render-video';

const requestSchema = z.strictObject({
  prompt: z.string().trim().min(3).max(600),
  candidateCount: z.number().int().min(1).max(3).default(2),
  seed: z.number().int().min(0).max(2_147_483_647).default(20260918),
});

const port = Number(process.env.PORT ?? 8787);
let busy = false;
const videoIdSchema = z.string().regex(/^generation-\d+-[a-z0-9]{6}$/);

const sendJson = (
  response: ServerResponse,
  status: number,
  body: unknown,
) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': 'http://localhost:3000',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  response.end(JSON.stringify(body));
};

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 16_384) {
      throw new Error('Request body exceeds 16 KiB');
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const serveVideo = async (
  request: IncomingMessage,
  response: ServerResponse,
  videoId: string,
) => {
  const parsedId = videoIdSchema.parse(videoId);
  const file = path.join(generatedVideoDirectory, `${parsedId}.mp4`);
  const details = await stat(file);
  const range = request.headers.range;
  if (!range) {
    response.writeHead(200, {
      'content-type': 'video/mp4',
      'content-length': details.size,
      'accept-ranges': 'bytes',
      'cache-control': 'private, max-age=3600',
    });
    createReadStream(file).pipe(response);
    return;
  }
  const match = range.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) {
    response.writeHead(416, {'content-range': `bytes */${details.size}`});
    response.end();
    return;
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : details.size - 1;
  if (start > end || end >= details.size) {
    response.writeHead(416, {'content-range': `bytes */${details.size}`});
    response.end();
    return;
  }
  response.writeHead(206, {
    'content-type': 'video/mp4',
    'content-length': end - start + 1,
    'content-range': `bytes ${start}-${end}/${details.size}`,
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600',
  });
  createReadStream(file, {start, end}).pipe(response);
};

const pruneGeneratedVideos = async (keep = 12) => {
  const files = (await readdir(generatedVideoDirectory))
    .filter((file) => videoIdSchema.safeParse(file.replace(/\.mp4$/, '')).success)
    .sort()
    .reverse();
  await Promise.all(
    files.slice(keep).map((file) =>
      rm(path.join(generatedVideoDirectory, file), {force: true}),
    ),
  );
};

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, null);
    return;
  }

  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(demoPage);
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, await checkModelRuntime());
    return;
  }

  const videoPath = request.url
    ? new URL(request.url, 'http://localhost').pathname
    : '';
  const videoMatch = videoPath.match(
    /^\/video\/(generation-\d+-[a-z0-9]{6})\.mp4$/,
  );
  if (request.method === 'GET' && videoMatch) {
    try {
      await serveVideo(request, response, videoMatch[1]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        sendJson(response, 404, {error: 'Video not found'});
      } else {
        throw error;
      }
    }
    return;
  }

  if (request.method === 'POST' && request.url === '/generate') {
    if (busy) {
      sendJson(response, 409, {
        error: 'A generation is already running on the local GPU',
      });
      return;
    }

    try {
      const input = requestSchema.parse(await readJson(request));
      busy = true;
      const result = await generateBestMotion(input);
      if (!result.winner) {
        sendJson(response, 422, result);
        return;
      }
      const videoId = `generation-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .padEnd(6, '0')}`;
      const outputPath = path.join(
        generatedVideoDirectory,
        `${videoId}.mp4`,
      );
      const render = await renderMotionSpecToMp4({
        spec: result.winner.spec,
        outputPath,
      });
      await pruneGeneratedVideos();
      sendJson(response, 200, {
        ...result,
        videoUrl: `/video/${videoId}.mp4`,
        render,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendJson(response, 400, {error: 'Invalid request', issues: error.issues});
      } else {
        sendJson(response, 500, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      busy = false;
    }
    return;
  }

  sendJson(response, 404, {error: 'Not found'});
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local generation API ready at http://127.0.0.1:${port}`);
});
