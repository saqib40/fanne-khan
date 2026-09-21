export const demoPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fanne Khan — Local Motion Lab</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: #f5f1e8;
      --muted: #9d9b95;
      --panel: rgba(19, 20, 24, 0.86);
      --line: rgba(255,255,255,0.1);
      --coral: #ff725e;
      --lime: #c9f774;
      --bg: #090a0d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      font-family: Inter, system-ui, sans-serif;
      background:
        radial-gradient(circle at 8% 2%, rgba(255,114,94,0.15), transparent 32rem),
        radial-gradient(circle at 94% 80%, rgba(201,247,116,0.09), transparent 30rem),
        var(--bg);
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: 0.25;
      background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
      background-size: 48px 48px;
    }
    button, textarea, select { font: inherit; }
    button { color: inherit; }
    main { width: min(1480px, 94vw); margin: 0 auto; padding: 26px 0 52px; position: relative; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
    .brand { display: flex; align-items: center; gap: 13px; }
    .mark { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; background: var(--coral); color: #120a08; font-weight: 800; font-size: 18px; transform: rotate(-4deg); }
    .brand-name { font-weight: 700; font-size: 17px; letter-spacing: -0.02em; }
    .brand-sub { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .13em; }
    .health { display: flex; gap: 9px; align-items: center; border: 1px solid var(--line); background: rgba(11,12,15,.72); padding: 9px 13px; border-radius: 999px; color: var(--muted); font-size: 13px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #73757b; box-shadow: 0 0 0 4px rgba(115,117,123,.1); }
    .health.ready .dot { background: var(--lime); box-shadow: 0 0 0 4px rgba(201,247,116,.12); }
    .grid { display: grid; grid-template-columns: minmax(330px, .78fr) minmax(520px, 1.35fr); gap: 20px; }
    .panel { border: 1px solid var(--line); background: var(--panel); backdrop-filter: blur(18px); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,.3); }
    .composer { padding: 26px; }
    .eyebrow { color: var(--coral); font: 700 11px Manrope; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 10px 0 9px; font-weight: 700; font-size: clamp(29px, 3vw, 47px); line-height: 1.03; letter-spacing: -.045em; max-width: 600px; }
    .lead { margin: 0 0 23px; color: var(--muted); line-height: 1.55; font-size: 14px; }
    label.field-label { display: block; margin: 0 0 9px; font-weight: 600; font-size: 13px; }
    textarea { width: 100%; min-height: 184px; resize: vertical; color: var(--ink); background: #0c0d11; border: 1px solid rgba(255,255,255,.13); border-radius: 15px; padding: 15px; line-height: 1.5; outline: none; transition: border .2s, box-shadow .2s; }
    textarea:focus { border-color: rgba(255,114,94,.75); box-shadow: 0 0 0 4px rgba(255,114,94,.09); }
    .counter { text-align: right; color: var(--muted); font-size: 11px; margin-top: 6px; }
    .presets { display: flex; flex-wrap: wrap; gap: 7px; margin: 15px 0 21px; }
    .preset { border: 1px solid var(--line); background: #15161b; padding: 8px 10px; border-radius: 9px; cursor: pointer; font-size: 12px; }
    .preset:hover { border-color: rgba(255,114,94,.55); background: #1c181a; }
    .options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .select-wrap { border: 1px solid var(--line); background: #101116; border-radius: 12px; padding: 9px 11px; }
    .select-wrap span { display: block; color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
    select { width: 100%; border: 0; color: var(--ink); background: transparent; outline: 0; margin-top: 3px; }
    .generate { width: 100%; border: 0; border-radius: 13px; padding: 14px 18px; cursor: pointer; background: var(--coral); color: #170b09; font-weight: 800; font-size: 14px; transition: transform .2s, filter .2s; }
    .generate:hover { transform: translateY(-1px); filter: brightness(1.06); }
    .generate:disabled { cursor: wait; filter: grayscale(.4); opacity: .65; transform: none; }
    .privacy { display: flex; gap: 8px; align-items: center; margin-top: 14px; color: var(--muted); font-size: 11px; }
    .stage { min-height: 700px; display: flex; flex-direction: column; overflow: hidden; }
    .stage-top { display: flex; justify-content: space-between; gap: 14px; align-items: center; padding: 17px 20px; border-bottom: 1px solid var(--line); }
    .stage-title { font-weight: 650; font-size: 14px; }
    .status { color: var(--muted); font-size: 12px; }
    .canvas { position: relative; min-height: 480px; flex: 1; display: grid; place-items: center; padding: 22px; background: #050608; }
    .canvas::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at center, transparent 45%, rgba(0,0,0,.32)); }
    video { position: relative; z-index: 1; max-width: 100%; max-height: 62vh; border-radius: 10px; background: black; box-shadow: 0 20px 60px rgba(0,0,0,.55); }
    .empty { position: relative; z-index: 1; text-align: center; color: var(--muted); max-width: 360px; }
    .empty-icon { width: 76px; height: 76px; margin: 0 auto 18px; border: 1px solid var(--line); border-radius: 50%; display: grid; place-items: center; font-size: 25px; background: rgba(255,255,255,.025); }
    .empty strong { display: block; color: var(--ink); font-weight: 650; font-size: 17px; margin-bottom: 6px; }
    .progress { display: none; position: relative; z-index: 2; width: min(480px, 88%); }
    .progress.active { display: block; }
    .progress-head { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .progress-head strong { font-weight: 650; font-size: 15px; }
    .bar { height: 5px; overflow: hidden; border-radius: 99px; background: #24262c; }
    .bar span { display: block; width: 36%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--coral), #ffbd72); animation: travel 1.55s ease-in-out infinite; }
    @keyframes travel { 0% { transform: translateX(-110%); } 100% { transform: translateX(300%); } }
    .steps { margin-top: 18px; display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; color: #696c74; font-size: 11px; text-align: center; }
    .steps .on { color: var(--ink); }
    .result { display: none; padding: 18px 20px 20px; border-top: 1px solid var(--line); }
    .result.show { display: block; }
    .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 9px; }
    .stat { border: 1px solid var(--line); border-radius: 12px; padding: 11px; background: rgba(255,255,255,.025); }
    .stat span { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
    .stat strong { display: block; margin-top: 4px; font-weight: 700; font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gates { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
    .gate { border: 1px solid rgba(201,247,116,.2); color: #dfffb0; background: rgba(201,247,116,.06); border-radius: 999px; padding: 6px 9px; font-size: 11px; }
    .actions { display: flex; gap: 9px; margin-top: 14px; }
    .action { text-decoration: none; border: 1px solid var(--line); background: #181a20; color: var(--ink); border-radius: 10px; padding: 9px 12px; font-size: 12px; cursor: pointer; }
    .error { display: none; margin-top: 12px; padding: 11px 12px; border: 1px solid rgba(255,114,94,.3); background: rgba(255,114,94,.08); color: #ffc0b6; border-radius: 11px; font-size: 12px; line-height: 1.45; white-space: pre-wrap; }
    .error.show { display: block; }
    @media (max-width: 960px) { .grid { grid-template-columns: 1fr; } .stage { min-height: 620px; } }
    @media (max-width: 560px) { main { width: 92vw; } header { align-items: flex-start; } .brand-sub { display: none; } .composer { padding: 20px; } .options, .stats { grid-template-columns: 1fr 1fr; } .canvas { min-height: 360px; padding: 12px; } }
  </style>
</head>
<body>
<main>
  <header>
    <div class="brand">
      <div class="mark">F</div>
      <div><div class="brand-name">Fanne Khan</div><div class="brand-sub">Local Motion Lab</div></div>
    </div>
    <div class="health" id="health"><span class="dot"></span><span id="healthText">Checking local model…</span></div>
  </header>
  <div class="grid">
    <section class="panel composer">
      <div class="eyebrow">DPO-tuned motion director</div>
      <h1>Turn words into motion.</h1>
      <p class="lead">Describe a short kinetic-typography piece. Your local model writes a constrained motion plan; trusted Remotion components render the result.</p>
      <form id="form">
        <label class="field-label" for="prompt">Creative brief</label>
        <textarea id="prompt" maxlength="600" required placeholder="Exact copy: MAKE IDEAS MOVE. Use editorial typography, warm ivory, charcoal, and one coral accent."></textarea>
        <div class="counter"><span id="count">0</span>/600</div>
        <div class="presets">
          <button class="preset" type="button" data-preset="hero">Hero title</button>
          <button class="preset" type="button" data-preset="product">Product</button>
          <button class="preset" type="button" data-preset="metric">Metric</button>
          <button class="preset" type="button" data-preset="event">Event</button>
        </div>
        <div class="options">
          <label class="select-wrap"><span>Candidates</span><select id="candidates"><option value="1">1 · Fast</option><option value="2" selected>2 · Recommended</option><option value="3">3 · Explore</option></select></label>
          <label class="select-wrap"><span>Seed</span><select id="seed"><option value="20261001" selected>Demo repeatable</option><option value="random">Fresh variation</option></select></label>
        </div>
        <button class="generate" id="generate" type="submit">Generate motion video →</button>
        <div class="privacy">◉ Runs locally · No prompt or video leaves this machine</div>
        <div class="error" id="error"></div>
      </form>
    </section>
    <section class="panel stage">
      <div class="stage-top"><div class="stage-title">Output preview</div><div class="status" id="status">Ready for a brief</div></div>
      <div class="canvas">
        <div class="empty" id="empty"><div class="empty-icon">◇</div><strong>Your motion piece appears here</strong><div>Generation, validation, ranking, and rendering happen in one local pipeline.</div></div>
        <div class="progress" id="progress">
          <div class="progress-head"><strong id="progressText">Directing the first frame…</strong><span id="timer">0:00</span></div>
          <div class="bar"><span></span></div>
          <div class="steps"><div class="on" id="step1">01 Generate</div><div id="step2">02 Validate</div><div id="step3">03 Render</div></div>
        </div>
        <video id="video" controls loop playsinline></video>
      </div>
      <div class="result" id="result">
        <div class="stats">
          <div class="stat"><span>Quality</span><strong id="score">—</strong></div>
          <div class="stat"><span>Duration</span><strong id="duration">—</strong></div>
          <div class="stat"><span>Format</span><strong id="format">—</strong></div>
          <div class="stat"><span>Total time</span><strong id="latency">—</strong></div>
        </div>
        <div class="gates" id="gates"></div>
        <div class="actions"><a class="action" id="download" download>Download MP4</a><button class="action" id="details" type="button">Copy MotionSpec</button></div>
      </div>
    </section>
  </div>
</main>
<script>
const presets = {
  hero: 'Create a 6-second kinetic title. Exact copy: TURN STATIC INTO SIGNAL. Use warm ivory on deep charcoal with one coral accent, measured motion, and no extra text.',
  product: 'Create a polished 7-second product announcement. Exact copy: NORTHSTAR NOTES / Ideas, finally in focus. Use midnight blue, icy cyan, and restrained depth.',
  metric: 'Create an 8-second metric reveal with exact copy: FASTER ITERATION / 63% / LESS REVIEW TIME. Make the number dominant with deep plum and pale pink.',
  event: 'Create a kinetic event card. Exact copy: MOTION NORTH / NOVEMBER 8–9 / HELSINKI. Use architectural type, cold blue, white, and a subtle grid rhythm.'
};
const form = document.getElementById('form');
const prompt = document.getElementById('prompt');
const button = document.getElementById('generate');
const empty = document.getElementById('empty');
const progress = document.getElementById('progress');
const video = document.getElementById('video');
const result = document.getElementById('result');
const error = document.getElementById('error');
const status = document.getElementById('status');
let latestSpec = null;
let timerHandle = null;

document.querySelectorAll('[data-preset]').forEach(function(item) {
  item.addEventListener('click', function() {
    prompt.value = presets[item.dataset.preset];
    document.getElementById('count').textContent = prompt.value.length;
    prompt.focus();
  });
});
prompt.addEventListener('input', function() {
  document.getElementById('count').textContent = prompt.value.length;
});
document.getElementById('details').addEventListener('click', async function() {
  if (!latestSpec) return;
  await navigator.clipboard.writeText(JSON.stringify(latestSpec, null, 2));
  this.textContent = 'Copied ✓';
  setTimeout(() => { this.textContent = 'Copy MotionSpec'; }, 1400);
});

async function checkHealth() {
  const health = document.getElementById('health');
  const text = document.getElementById('healthText');
  try {
    const response = await fetch('/health');
    const body = await response.json();
    if (body.available && body.installed) {
      health.classList.add('ready');
      text.textContent = body.backend === 'unsloth' ? 'DPO adapter ready' : 'Ollama baseline ready';
      return;
    }
    text.textContent = 'Model runtime unavailable';
  } catch {
    text.textContent = 'API unavailable';
  }
}

function beginProgress() {
  empty.style.display = 'none';
  video.style.display = 'none';
  result.classList.remove('show');
  progress.classList.add('active');
  error.classList.remove('show');
  button.disabled = true;
  button.textContent = 'Creating locally…';
  status.textContent = 'Model is composing';
  const started = Date.now();
  timerHandle = setInterval(function() {
    const seconds = Math.floor((Date.now() - started) / 1000);
    document.getElementById('timer').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    if (seconds > 12) {
      document.getElementById('step2').classList.add('on');
      document.getElementById('progressText').textContent = 'Checking composition and motion…';
    }
    if (seconds > 28) {
      document.getElementById('step3').classList.add('on');
      document.getElementById('progressText').textContent = 'Rendering the winning direction…';
    }
  }, 500);
}

function finishProgress() {
  clearInterval(timerHandle);
  progress.classList.remove('active');
  button.disabled = false;
  button.textContent = 'Generate another variation →';
}

form.addEventListener('submit', async function(event) {
  event.preventDefault();
  if (!prompt.value.trim()) return;
  beginProgress();
  const seedValue = document.getElementById('seed').value;
  try {
    const response = await fetch('/generate', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        prompt: prompt.value.trim(),
        candidateCount: Number(document.getElementById('candidates').value),
        seed: seedValue === 'random' ? Math.floor(Math.random() * 2147483647) : Number(seedValue)
      })
    });
    const body = await response.json();
    if (!response.ok) {
      const failures = [].concat(body.generationFailures || [], body.evaluationFailures || []);
      throw new Error(body.error || failures.join('\\n') || 'No candidate survived the quality gates.');
    }
    latestSpec = body.winner.spec;
    video.src = body.videoUrl + '?v=' + Date.now();
    video.style.display = 'block';
    video.load();
    video.play().catch(function() {});
    document.getElementById('score').textContent = body.winner.score.toFixed(1);
    document.getElementById('duration').textContent = (body.winner.spec.durationInFrames / body.winner.spec.fps).toFixed(1) + ' sec';
    document.getElementById('format').textContent = body.winner.spec.width + '×' + body.winner.spec.height;
    document.getElementById('latency').textContent = (body.elapsedSeconds + body.render.elapsedSeconds).toFixed(1) + ' sec';
    const gates = document.getElementById('gates');
    gates.innerHTML = '';
    Object.entries(body.winner.evaluation.hardGates).forEach(function(entry) {
      const chip = document.createElement('span');
      chip.className = 'gate';
      chip.textContent = '✓ ' + entry[0].replace(/([A-Z])/g, ' $1').toLowerCase();
      gates.appendChild(chip);
    });
    document.getElementById('download').href = body.videoUrl;
    result.classList.add('show');
    status.textContent = body.winner.spec.name + ' · passed every hard gate';
  } catch (cause) {
    empty.style.display = 'block';
    error.textContent = cause instanceof Error ? cause.message : String(cause);
    error.classList.add('show');
    status.textContent = 'Generation needs another attempt';
  } finally {
    finishProgress();
  }
});

video.style.display = 'none';
checkHealth();
</script>
</body>
</html>`;
