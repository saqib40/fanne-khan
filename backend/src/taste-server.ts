import {createReadStream} from 'node:fs';
import {
  appendFile,
  readFile,
  readdir,
  stat,
} from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const configuredPath = (environmentName: string, fallback: string) =>
  path.resolve(root, process.env[environmentName] ?? fallback);
const pairDirectory = configuredPath(
  'TASTE_PAIR_DIRECTORY',
  'data/preferences/pairs',
);
const videoRoot = configuredPath('TASTE_VIDEO_ROOT', 'out/preferences');
const reviewsPath = configuredPath(
  'TASTE_REVIEWS_PATH',
  'data/preferences/reviews.jsonl',
);
const humanPath = configuredPath(
  'TASTE_HUMAN_PATH',
  'data/preferences/human.jsonl',
);
const port = Number(process.env.PORT ?? 8790);

const reviewSchema = z
  .strictObject({
    pairId: z.string().regex(/^taste-[a-z]+-\d{2}$/),
    choice: z.enum(['A', 'B', 'tie', 'reject-both']),
    strength: z.enum(['slight', 'clear', 'strong']),
    reasons: z
      .array(
        z.enum([
          'hierarchy',
          'pacing',
          'motion',
          'layout',
          'typography',
          'color',
          'restraint',
          'originality',
        ]),
      )
      .max(8),
    note: z.string().trim().max(500),
  })
  .superRefine((review, context) => {
    if (
      (review.choice === 'A' || review.choice === 'B') &&
      review.reasons.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reasons'],
        message: 'Choose at least one reason for an A/B preference',
      });
    }
  });

type PairManifest = {
  version: '1.0';
  id: string;
  category: string;
  prompt: string;
  candidates: {
    A: {spec: unknown; generation: unknown; hardGates: unknown};
    B: {spec: unknown; generation: unknown; hardGates: unknown};
  };
};

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  value: unknown,
) => {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(value));
};

const readBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 32_768) {
      throw new Error('Request body exceeds 32 KiB');
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const readJsonLines = async (file: string): Promise<unknown[]> => {
  try {
    return (await readFile(file, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
};

const readPairs = async (): Promise<PairManifest[]> => {
  try {
    const files = (await readdir(pairDirectory))
      .filter((file) => file.endsWith('.json'))
      .sort();
    return Promise.all(
      files.map(async (file) =>
        JSON.parse(
          await readFile(path.join(pairDirectory, file), 'utf8'),
        ),
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
};

const serveVideo = async (
  request: IncomingMessage,
  response: ServerResponse,
  pairId: string,
  side: 'A' | 'B',
) => {
  const file = path.join(videoRoot, pairId, `${side}.mp4`);
  const details = await stat(file);
  const range = request.headers.range;
  if (!range) {
    response.writeHead(200, {
      'content-type': 'video/mp4',
      'content-length': details.size,
      'accept-ranges': 'bytes',
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
  });
  createReadStream(file, {start, end}).pipe(response);
};

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Motion Taste Review</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #090b10; color: #f5f3ed; }
    main { width: min(1500px, 96vw); margin: 0 auto; padding: 24px 0 48px; }
    header { display: flex; justify-content: space-between; gap: 24px; align-items: start; }
    .muted { color: #959cab; }
    #prompt { font-size: clamp(18px, 2vw, 28px); line-height: 1.3; max-width: 1000px; }
    .videos { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 22px 0; }
    .candidate { background: #11151d; border: 1px solid #252b37; border-radius: 16px; padding: 12px; }
    .label { font-size: 22px; font-weight: 750; margin: 0 0 10px; }
    video { width: 100%; max-height: 62vh; background: #000; border-radius: 10px; }
    .controls { background: #11151d; border: 1px solid #252b37; border-radius: 16px; padding: 18px; }
    .row { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0; }
    button, select, textarea { font: inherit; }
    button { color: #f5f3ed; background: #252b37; border: 1px solid #3a4252; border-radius: 10px; padding: 12px 18px; cursor: pointer; }
    button:hover { background: #333c4b; }
    button.primary { background: #285df2; border-color: #4978ff; }
    button.danger { background: #431c25; }
    label.tag { display: flex; gap: 6px; align-items: center; background: #191e28; border-radius: 9px; padding: 8px 10px; }
    textarea { width: 100%; min-height: 76px; color: #f5f3ed; background: #0d1016; border: 1px solid #333a48; border-radius: 10px; padding: 10px; }
    #message { min-height: 24px; color: #ffbd5d; }
    @media (max-width: 800px) { .videos { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<main>
  <header>
    <div>
      <div class="muted" id="meta">Loading pairs…</div>
      <div id="prompt"></div>
    </div>
    <div class="muted">Keys: 1 = A, 2 = B, T = tie, R = reject</div>
  </header>
  <section class="videos">
    <article class="candidate"><div class="label">A</div><video id="videoA" controls loop muted autoplay playsinline></video></article>
    <article class="candidate"><div class="label">B</div><video id="videoB" controls loop muted autoplay playsinline></video></article>
  </section>
  <section class="controls">
    <strong>Why?</strong>
    <div class="row" id="reasons"></div>
    <div class="row">
      <label>Strength
        <select id="strength">
          <option value="clear">Clear</option>
          <option value="slight">Slight</option>
          <option value="strong">Strong</option>
        </select>
      </label>
    </div>
    <textarea id="note" placeholder="Optional note about the decision"></textarea>
    <div class="row">
      <button class="primary" data-choice="A">Prefer A</button>
      <button class="primary" data-choice="B">Prefer B</button>
      <button data-choice="tie">Tie</button>
      <button class="danger" data-choice="reject-both">Reject both</button>
    </div>
    <div id="message"></div>
  </section>
</main>
<script>
const reasonNames = ['hierarchy','pacing','motion','layout','typography','color','restraint','originality'];
const reasonRoot = document.getElementById('reasons');
for (const reason of reasonNames) {
  const label = document.createElement('label');
  label.className = 'tag';
  label.innerHTML = '<input type="checkbox" value="' + reason + '"> ' + reason;
  reasonRoot.appendChild(label);
}
let pairs = [];
let current = 0;
const render = () => {
  if (!pairs.length || current >= pairs.length) {
    document.getElementById('meta').textContent = 'Review complete';
    document.getElementById('prompt').textContent = 'No unreviewed pairs are ready.';
    document.querySelector('.videos').style.display = 'none';
    document.querySelector('.controls').style.display = 'none';
    return;
  }
  const pair = pairs[current];
  document.getElementById('meta').textContent = (current + 1) + ' of ' + pairs.length + ' · ' + pair.category;
  document.getElementById('prompt').textContent = pair.prompt;
  document.getElementById('videoA').src = pair.videoA;
  document.getElementById('videoB').src = pair.videoB;
  document.getElementById('message').textContent = '';
};
const load = async () => {
  const response = await fetch('/api/pairs');
  const body = await response.json();
  pairs = body.pairs;
  render();
};
const submit = async (choice) => {
  if (!pairs[current]) return;
  const reasons = [...document.querySelectorAll('#reasons input:checked')].map((item) => item.value);
  if ((choice === 'A' || choice === 'B') && reasons.length === 0) {
    document.getElementById('message').textContent = 'Choose at least one reason for an A/B preference.';
    return;
  }
  const response = await fetch('/api/reviews', {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({
      pairId: pairs[current].id,
      choice,
      strength: document.getElementById('strength').value,
      reasons,
      note: document.getElementById('note').value
    })
  });
  const body = await response.json();
  if (!response.ok) {
    document.getElementById('message').textContent = body.error || 'Could not save review';
    return;
  }
  document.querySelectorAll('#reasons input').forEach((item) => item.checked = false);
  document.getElementById('note').value = '';
  current += 1;
  render();
};
document.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', () => submit(button.dataset.choice)));
document.addEventListener('keydown', (event) => {
  if (document.activeElement.tagName === 'TEXTAREA') return;
  if (event.key === '1') submit('A');
  if (event.key === '2') submit('B');
  if (event.key.toLowerCase() === 't') submit('tie');
  if (event.key.toLowerCase() === 'r') submit('reject-both');
});
load().catch((error) => document.getElementById('message').textContent = error.message);
</script>
</body>
</html>`;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
      response.end(page);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/pairs') {
      const [pairs, reviews] = await Promise.all([
        readPairs(),
        readJsonLines(reviewsPath),
      ]);
      const reviewed = new Set(
        reviews
          .map((review) =>
            typeof review === 'object' &&
            review !== null &&
            'pairId' in review &&
            typeof review.pairId === 'string'
              ? review.pairId
              : undefined,
          )
          .filter(Boolean),
      );
      sendJson(response, 200, {
        pairs: pairs
          .filter((pair) => !reviewed.has(pair.id))
          .map((pair) => ({
            id: pair.id,
            category: pair.category,
            prompt: pair.prompt,
            videoA: `/video/${pair.id}/A.mp4`,
            videoB: `/video/${pair.id}/B.mp4`,
          })),
        generated: pairs.length,
        reviewed: reviewed.size,
      });
      return;
    }
    const videoMatch = url.pathname.match(
      /^\/video\/(taste-[a-z]+-\d{2})\/([AB])\.mp4$/,
    );
    if (request.method === 'GET' && videoMatch) {
      await serveVideo(
        request,
        response,
        videoMatch[1],
        videoMatch[2] as 'A' | 'B',
      );
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/reviews') {
      const review = reviewSchema.parse(await readBody(request));
      const existing = await readJsonLines(reviewsPath);
      if (
        existing.some(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            'pairId' in item &&
            item.pairId === review.pairId,
        )
      ) {
        sendJson(response, 409, {error: 'This pair has already been reviewed'});
        return;
      }
      const manifest = JSON.parse(
        await readFile(
          path.join(pairDirectory, `${review.pairId}.json`),
          'utf8',
        ),
      ) as PairManifest;
      const timestamp = new Date().toISOString();
      await appendFile(
        reviewsPath,
        `${JSON.stringify({...review, createdAt: timestamp})}\n`,
      );
      if (review.choice === 'A' || review.choice === 'B') {
        const rejectedSide = review.choice === 'A' ? 'B' : 'A';
        await appendFile(
          humanPath,
          `${JSON.stringify({
            id: `human-${review.pairId}`,
            pairId: review.pairId,
            createdAt: timestamp,
            prompt: manifest.prompt,
            choice: 'chosen',
            chosen: manifest.candidates[review.choice].spec,
            rejected: manifest.candidates[rejectedSide].spec,
            strength: review.strength,
            reasons: review.reasons,
            reason: [...review.reasons, review.note]
              .filter(Boolean)
              .join('; '),
            source: 'human-blinded-pair',
          })}\n`,
        );
      }
      sendJson(response, 201, {status: 'saved'});
      return;
    }
    sendJson(response, 404, {error: 'Not found'});
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(response, 400, {
        error: 'Invalid review',
        issues: error.issues,
      });
    } else if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      sendJson(response, 404, {error: 'Pair or video not found'});
    } else {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Taste review ready at http://127.0.0.1:${port}`);
});
