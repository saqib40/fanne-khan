export const demoPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fanne Khan — Motion Lab</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@700;800&family=Syne:wght@700;800&family=Rozha+One&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #09090b;
      --surface-glass: rgba(18, 19, 23, 0.72);
      --border-glass: rgba(255, 255, 255, 0.1);
      --border-focus: rgba(255, 255, 255, 0.28);
      --ink: #ececed;
      --ink-dim: #a1a1aa;
      --muted: #71717a;
      --faint: #3f3f46;
      --accent: #f4f4f5;
      --accent-text: #09090b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      overflow-x: hidden;
    }
    body {
      color: var(--ink);
      font-family: 'Inter', -apple-system, sans-serif;
      background:
        radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255, 255, 255, 0.04), transparent 70%),
        radial-gradient(ellipse 60% 40% at 50% 110%, rgba(255, 255, 255, 0.02), transparent 60%),
        var(--bg);
      -webkit-font-smoothing: antialiased;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    button, textarea, select { font: inherit; }

    /* Top Ambient HUD */
    .hud-top {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 40;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 26px 36px;
      pointer-events: none;
    }
    .hud-top > * {
      pointer-events: auto;
    }
    .hud-left {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13.5px;
      color: var(--muted);
      letter-spacing: 0.05em;
    }
    .hud-link {
      color: var(--muted);
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13.5px;
      transition: color 0.15s ease;
    }
    .hud-link:hover {
      color: var(--ink);
    }
    .hud-right {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      color: var(--muted);
    }

    /* Main Center Canvas Stage */
    .stage-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 24px 170px;
      position: relative;
      z-index: 10;
      min-height: 100vh;
    }

    /* Hero Typographic Centerpiece (Saloon style) */
    .hero-canvas {
      text-align: center;
      transition: opacity 0.4s ease, transform 0.4s ease;
      max-width: 1000px;
      user-select: none;
    }
    .hero-hindi {
      font-family: 'Rozha One', serif;
      font-size: clamp(80px, 14.5vw, 158px);
      line-height: 1.05;
      color: var(--ink);
      text-shadow: 0 14px 60px rgba(0, 0, 0, 0.9);
      letter-spacing: 0.02em;
    }
    .hero-latin {
      font-family: 'Syne', 'Plus Jakarta Sans', sans-serif;
      font-weight: 700;
      font-size: clamp(14px, 2.2vw, 20px);
      letter-spacing: 0.32em;
      text-transform: uppercase;
      color: var(--muted);
      margin-top: 12px;
    }

    /* Video Player Centerpiece */
    .player-wrap {
      display: none;
      position: relative;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 960px;
      animation: fadeIn 0.4s ease forwards;
    }
    video {
      max-width: 100%;
      max-height: 58vh;
      border-radius: 14px;
      background: #000;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    /* Progress & Loading State */
    .progress-box {
      display: none;
      width: min(440px, 90vw);
      text-align: center;
      animation: fadeIn 0.3s ease;
    }
    .progress-box.active { display: block; }
    .progress-status {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--ink);
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
    }
    .progress-bar-track {
      height: 3px;
      overflow: hidden;
      border-radius: 99px;
      background: rgba(255, 255, 255, 0.08);
      margin-bottom: 14px;
    }
    .progress-bar-fill {
      display: block;
      width: 35%;
      height: 100%;
      background: #e4e4e7;
      border-radius: inherit;
      animation: travel 1.4s ease-in-out infinite;
    }
    @keyframes travel {
      0% { transform: translateX(-110%); }
      100% { transform: translateX(330%); }
    }
    .progress-steps {
      display: flex;
      justify-content: center;
      gap: 20px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--faint);
    }
    .progress-steps .on {
      color: var(--ink);
    }

    /* Telemetry Pill Strip (Post-render) */
    .telemetry-strip {
      display: none;
      margin-top: 18px;
      background: var(--surface-glass);
      border: 1px solid var(--border-glass);
      backdrop-filter: blur(20px);
      padding: 8px 18px;
      border-radius: 999px;
      align-items: center;
      gap: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--ink-dim);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
      flex-wrap: wrap;
      justify-content: center;
    }
    .telemetry-strip.show { display: flex; }
    .telemetry-item {
      display: flex;
      gap: 5px;
      align-items: baseline;
    }
    .telemetry-item span {
      color: var(--muted);
      font-size: 10px;
      text-transform: uppercase;
    }
    .telemetry-item strong {
      color: var(--ink);
      font-weight: 500;
    }
    .telemetry-actions {
      display: flex;
      gap: 8px;
      margin-left: 6px;
    }
    .hud-action {
      text-decoration: none;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-glass);
      color: var(--ink);
      border-radius: 999px;
      padding: 4px 11px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .hud-action:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: var(--border-focus);
    }
    .gates-container {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .gate-chip {
      border: 1px solid var(--border-glass);
      color: var(--ink-dim);
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 10px;
    }

    /* Floating Bottom Dock (Saloon player capsule style) */
    .dock-container {
      position: fixed;
      bottom: 30px;
      left: 0;
      right: 0;
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0 20px;
    }

    /* Quiet Presets Row above Dock */
    .presets-dock {
      display: flex;
      gap: 9px;
      margin-bottom: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .preset-pill {
      background: rgba(18, 19, 23, 0.65);
      border: 1px solid var(--border-glass);
      backdrop-filter: blur(14px);
      color: var(--ink-dim);
      padding: 5px 13px;
      border-radius: 999px;
      font-size: 12.5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .preset-pill:hover {
      background: rgba(255, 255, 255, 0.09);
      border-color: var(--border-focus);
      color: var(--ink);
    }

    /* The Main Capsule Bar */
    .capsule-bar {
      width: min(920px, 94vw);
      background: var(--surface-glass);
      border: 1px solid var(--border-glass);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border-radius: 999px;
      padding: 9px 12px 9px 22px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .capsule-bar:focus-within {
      border-color: var(--border-focus);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.14);
    }

    .capsule-input-wrap {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
    }
    textarea.capsule-input {
      width: 100%;
      height: 26px;
      min-height: 26px;
      max-height: 80px;
      resize: none;
      background: transparent;
      border: none;
      outline: none;
      color: var(--ink);
      font-size: 14.5px;
      line-height: 1.45;
      padding: 2px 0;
    }
    textarea.capsule-input::placeholder {
      color: var(--faint);
    }
    .capsule-counter {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--muted);
      margin-left: 10px;
      white-space: nowrap;
    }

    /* Inline Selectors */
    .capsule-selectors {
      display: flex;
      align-items: center;
      gap: 10px;
      border-left: 1px solid var(--border-glass);
      padding-left: 14px;
    }
    .capsule-select-group {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .capsule-select-label {
      color: var(--muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      text-transform: uppercase;
    }
    .capsule-select-group select {
      border: none;
      background: transparent;
      color: var(--ink-dim);
      font-size: 12.5px;
      outline: none;
      cursor: pointer;
    }
    .capsule-select-group select option {
      background: #141519;
      color: var(--ink);
    }

    /* Circular Play/Generate CTA Button (Like Saloon Player) */
    .btn-capsule-play {
      width: 46px;
      height: 46px;
      min-width: 46px;
      border-radius: 50%;
      background: var(--accent);
      border: none;
      color: var(--accent-text);
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: transform 0.15s ease, background-color 0.15s ease, opacity 0.15s ease;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    }
    .btn-capsule-play:hover {
      transform: scale(1.05);
      background: #ffffff;
    }
    .btn-capsule-play:disabled {
      cursor: wait;
      opacity: 0.35;
      transform: none;
    }
    .btn-capsule-play svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }

    /* Error Banner */
    .dock-error {
      display: none;
      margin-top: 10px;
      padding: 8px 14px;
      background: rgba(18, 19, 23, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(16px);
      border-radius: 999px;
      color: #e4e4e7;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      max-width: min(780px, 94vw);
      text-align: center;
    }
    .dock-error.show { display: block; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      .capsule-selectors { display: none; }
      .hero-title { font-size: 48px; }
      .stage-container { padding-bottom: 190px; }
      .capsule-bar { border-radius: 20px; }
    }
  </style>
</head>
<body>

  <!-- Top Ambient HUD -->
  <header class="hud-top">
    <div class="hud-left" id="liveTime">01:22 am</div>
    <div class="hud-right">
      <a href="https://github.com/saqib40/fanne-khan" target="_blank" rel="noopener noreferrer" class="hud-link">GitHub ↗</a>
    </div>
  </header>

  <!-- Main Centerpiece Canvas -->
  <main class="stage-container">
    
    <!-- Hero Typographic Identity (Empty State) -->
    <div class="hero-canvas" id="empty">
      <h1 class="hero-hindi">फन्ने खां</h1>
      <div class="hero-latin">FANNE KHAN</div>
    </div>

    <!-- Progress State -->
    <div class="progress-box" id="progress">
      <div class="progress-status">
        <strong id="progressText">Composing initial frame…</strong>
        <span id="timer">0:00</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill"></div>
      </div>
      <div class="progress-steps">
        <span class="on" id="step1">Generate</span>
        <span id="step2">Validate</span>
        <span id="step3">Render</span>
      </div>
    </div>

    <!-- Video Output Player -->
    <div class="player-wrap" id="playerWrap">
      <video id="video" controls loop playsinline></video>
      
      <!-- Telemetry Strip (Saloon style floating bar) -->
      <div class="telemetry-strip" id="result">
        <div class="telemetry-item"><span>Score</span><strong id="score">—</strong></div>
        <div class="telemetry-item"><span>Duration</span><strong id="duration">—</strong></div>
        <div class="telemetry-item"><span>Format</span><strong id="format">—</strong></div>
        <div class="telemetry-item"><span>Time</span><strong id="latency">—</strong></div>
        <div class="gates-container" id="gates"></div>
        <div class="telemetry-actions">
          <a class="hud-action" id="download" download>Download</a>
          <button class="hud-action" id="details" type="button">Copy Spec</button>
        </div>
      </div>
    </div>

  </main>

  <!-- Floating HUD Dock (Bottom Controller) -->
  <footer class="dock-container">
    
    <!-- Floating Presets -->
    <div class="presets-dock">
      <button class="preset-pill" type="button" data-preset="hero">Hero Title</button>
      <button class="preset-pill" type="button" data-preset="product">Product Launch</button>
      <button class="preset-pill" type="button" data-preset="metric">Metric Reveal</button>
      <button class="preset-pill" type="button" data-preset="event">Kinetic Event</button>
    </div>

    <!-- The Capsule Bar -->
    <form class="capsule-bar" id="form">
      <div class="capsule-input-wrap">
        <textarea class="capsule-input" id="prompt" maxlength="600" required rows="1" placeholder="Type a creative motion brief... (e.g. Exact copy: TURN STATIC INTO SIGNAL)"></textarea>
        <span class="capsule-counter"><span id="count">0</span>/600</span>
      </div>

      <div class="capsule-selectors">
        <label class="capsule-select-group">
          <span class="capsule-select-label">Candidates:</span>
          <select id="candidates">
            <option value="1">1 · Fast</option>
            <option value="2" selected>2 · Recommended</option>
            <option value="3">3 · Explore</option>
          </select>
        </label>
        <label class="capsule-select-group">
          <span class="capsule-select-label">Seed:</span>
          <select id="seed">
            <option value="20261001" selected>Demo repeatable</option>
            <option value="random">Fresh variation</option>
          </select>
        </label>
      </div>

      <!-- Play / Generate Button -->
      <button class="btn-capsule-play" id="generate" type="submit" title="Generate motion piece">
        <svg viewBox="0 0 24 24">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
    </form>

    <div class="dock-error" id="error"></div>
  </footer>

<script>
// Live clock
function updateClock() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  const clockEl = document.getElementById('liveTime');
  if (clockEl) clockEl.textContent = displayHours + ':' + minutes + ' ' + ampm;
}
setInterval(updateClock, 1000);
updateClock();

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
const playerWrap = document.getElementById('playerWrap');
const video = document.getElementById('video');
const result = document.getElementById('result');
const error = document.getElementById('error');
const status = document.getElementById('status');
let latestSpec = null;
let timerHandle = null;

// Auto-expand textarea slightly
prompt.addEventListener('input', function() {
  document.getElementById('count').textContent = prompt.value.length;
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 72) + 'px';
});

document.querySelectorAll('[data-preset]').forEach(function(item) {
  item.addEventListener('click', function() {
    prompt.value = presets[item.dataset.preset];
    document.getElementById('count').textContent = prompt.value.length;
    prompt.style.height = 'auto';
    prompt.style.height = Math.min(prompt.scrollHeight, 72) + 'px';
    prompt.focus();
  });
});

document.getElementById('details').addEventListener('click', async function() {
  if (!latestSpec) return;
  await navigator.clipboard.writeText(JSON.stringify(latestSpec, null, 2));
  this.textContent = 'Copied ✓';
  setTimeout(() => { this.textContent = 'Copy Spec'; }, 1400);
});

function beginProgress() {
  empty.style.display = 'none';
  playerWrap.style.display = 'none';
  video.style.display = 'none';
  result.classList.remove('show');
  progress.classList.add('active');
  error.classList.remove('show');
  button.disabled = true;
  if (status) status.textContent = 'Directing piece…';
  const started = Date.now();
  timerHandle = setInterval(function() {
    const seconds = Math.floor((Date.now() - started) / 1000);
    document.getElementById('timer').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    if (seconds > 12) {
      document.getElementById('step2').classList.add('on');
      document.getElementById('progressText').textContent = 'Validating motion…';
    }
    if (seconds > 28) {
      document.getElementById('step3').classList.add('on');
      document.getElementById('progressText').textContent = 'Rendering winning piece…';
    }
  }, 500);
}

function finishProgress() {
  clearInterval(timerHandle);
  progress.classList.remove('active');
  button.disabled = false;
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
      throw new Error(body.error || failures.join('\\n') || 'No candidate passed quality gates.');
    }
    latestSpec = body.winner.spec;
    video.src = body.videoUrl + '?v=' + Date.now();
    playerWrap.style.display = 'flex';
    video.style.display = 'block';
    video.load();
    video.play().catch(function() {});
    document.getElementById('score').textContent = body.winner.score.toFixed(1);
    document.getElementById('duration').textContent = (body.winner.spec.durationInFrames / body.winner.spec.fps).toFixed(1) + 's';
    document.getElementById('format').textContent = body.winner.spec.width + '×' + body.winner.spec.height;
    document.getElementById('latency').textContent = (body.elapsedSeconds + body.render.elapsedSeconds).toFixed(1) + 's';
    const gates = document.getElementById('gates');
    gates.innerHTML = '';
    Object.entries(body.winner.evaluation.hardGates).forEach(function(entry) {
      const chip = document.createElement('span');
      chip.className = 'gate-chip';
      chip.textContent = '✓ ' + entry[0].replace(/([A-Z])/g, ' $1').toLowerCase();
      gates.appendChild(chip);
    });
    document.getElementById('download').href = body.videoUrl;
    result.classList.add('show');
    if (status) status.textContent = body.winner.spec.name;
  } catch (cause) {
    empty.style.display = 'block';
    error.textContent = cause instanceof Error ? cause.message : String(cause);
    error.classList.add('show');
    if (status) status.textContent = 'Generation failed';
  } finally {
    finishProgress();
  }
});
</script>
</body>
</html>`;
