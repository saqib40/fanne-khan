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
      --surface: #111114;
      --surface-raised: #17171b;
      --line: rgba(255, 255, 255, 0.1);
      --line-strong: rgba(255, 255, 255, 0.22);
      --ink: #f1f1f2;
      --ink-dim: #b0b0b7;
      --muted: #74747d;
      --faint: #48484f;
      --accent: #f4f4f5;
      --accent-text: #09090b;
      --content-width: 960px;
      --radius: 12px;
      --space-page: clamp(20px, 4vw, 48px);
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
        radial-gradient(ellipse 70% 40% at 50% -10%, rgba(255, 255, 255, 0.035), transparent 72%),
        var(--bg);
      -webkit-font-smoothing: antialiased;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    button, textarea, select { font: inherit; }
    button:focus-visible,
    a:focus-visible,
    textarea:focus-visible,
    select:focus-visible {
      outline: 1px solid var(--ink-dim);
      outline-offset: 3px;
    }

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
      padding: 24px var(--space-page);
      pointer-events: none;
    }
    .hud-top > * {
      pointer-events: auto;
    }
    .hud-left {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--muted);
      letter-spacing: 0.08em;
    }
    .hud-link {
      color: var(--muted);
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.04em;
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
      padding: 80px var(--space-page) 160px;
      position: relative;
      z-index: 10;
      min-height: 100vh;
    }
    body.conversation-active .stage-container {
      flex: 0 0 auto;
      justify-content: flex-start;
      padding-top: 96px;
      padding-bottom: 40px;
      min-height: calc(100vh - 96px);
    }

    /* Hero Typographic Centerpiece (Saloon style) */
    .hero-canvas {
      position: fixed;
      top: 50%;
      left: 50%;
      text-align: center;
      transform: translate(-50%, -50%) scale(1);
      transform-origin: center top;
      transition:
        top 0.8s cubic-bezier(0.22, 1, 0.36, 1),
        transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
      max-width: 1000px;
      user-select: none;
      pointer-events: none;
      will-change: top, transform;
      z-index: 20;
    }
    body.conversation-active .hero-canvas {
      top: 12px;
      transform: translate(-50%, 0) scale(0.22);
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
      opacity: 1;
      transform: translateY(0);
      transition:
        opacity 0.32s ease,
        transform 0.42s cubic-bezier(0.4, 0, 1, 1);
    }
    body.conversation-active .hero-latin {
      opacity: 0;
      transform: translateY(-12px);
    }

    /* Submitted brief */
    .user-turn {
      display: none;
      width: min(var(--content-width), 100%);
      justify-content: flex-start;
      margin-bottom: 28px;
      animation: fadeIn 0.3s ease forwards;
    }
    .user-turn.show {
      display: flex;
    }
    .user-message {
      width: 100%;
      padding: 0 0 22px;
      border-bottom: 1px solid var(--line);
    }
    .user-message-label {
      display: block;
      margin-bottom: 8px;
      color: var(--muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .user-message p {
      max-width: 760px;
      color: var(--ink-dim);
      font-size: 15px;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    /* Video Player Centerpiece */
    .player-wrap {
      display: none;
      position: relative;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: var(--content-width);
      animation: fadeIn 0.4s ease forwards;
      scroll-margin: 88px 0 24px;
    }
    video {
      display: block;
      max-width: 100%;
      max-height: 58vh;
      object-fit: contain;
      border-radius: var(--radius);
      background: #000;
      box-shadow: 0 20px 56px rgba(0, 0, 0, 0.45);
      outline: 1px solid rgba(255, 255, 255, 0.08);
    }
    body.conversation-active video {
      max-height: 58vh;
    }

    /* Progress & Loading State */
    .progress-box {
      display: none;
      width: min(620px, 100%);
      text-align: left;
      animation: fadeIn 0.3s ease;
    }
    .progress-box.active { display: block; }
    .progress-status {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--ink-dim);
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
    }
    .progress-bar-track {
      height: 3px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.08);
      margin-bottom: 16px;
    }
    .progress-bar-fill {
      display: block;
      width: 35%;
      height: 100%;
      background: #e4e4e7;
      animation: travel 1.4s ease-in-out infinite;
    }
    @keyframes travel {
      0% { transform: translateX(-110%); }
      100% { transform: translateX(330%); }
    }
    .progress-steps {
      display: flex;
      justify-content: flex-start;
      gap: 20px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--faint);
    }
    .progress-steps .on {
      color: var(--ink);
    }

    /* Editorial result details */
    .result-details {
      display: none;
      width: 100%;
      margin-top: 22px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--ink-dim);
    }
    .result-details.show {
      display: block;
      animation: fadeIn 0.3s ease forwards;
    }
    .metadata-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 20px;
      margin: 0;
    }
    .metadata-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .metadata-item dt {
      color: var(--muted);
      font-size: 9px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .metadata-item dd {
      margin: 0;
      color: var(--ink);
      font-weight: 500;
    }
    .result-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .quality-summary {
      display: flex;
      align-items: center;
      gap: 9px;
      color: var(--ink-dim);
      font-size: 10px;
    }
    .quality-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #a7d7b2;
      box-shadow: 0 0 0 3px rgba(167, 215, 178, 0.08);
    }
    .result-actions {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .text-action {
      padding: 0;
      text-decoration: none;
      background: transparent;
      border: 0;
      color: var(--ink-dim);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.05em;
      cursor: pointer;
      transition: color 0.15s ease;
    }
    .text-action:hover {
      color: var(--ink);
    }

    /* Prompt composer */
    .dock-container {
      position: fixed;
      bottom: 26px;
      left: 0;
      right: 0;
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0 20px;
    }
    body.conversation-active .dock-container {
      position: relative;
      inset: auto;
      flex: 0 0 auto;
      padding: 0 var(--space-page) 32px;
    }

    /* Quiet Presets Row above Dock */
    .presets-dock {
      display: flex;
      gap: 22px;
      margin-bottom: 14px;
      flex-wrap: wrap;
      justify-content: center;
    }
    body.conversation-active .presets-dock {
      display: none;
    }
    .preset-pill {
      background: transparent;
      border: 0;
      color: var(--muted);
      padding: 3px 0;
      font-size: 11px;
      cursor: pointer;
      transition: color 0.15s ease;
    }
    .preset-pill:hover {
      color: var(--ink);
    }

    /* Main composer */
    .capsule-bar {
      width: min(var(--content-width), 100%);
      background: rgba(17, 17, 20, 0.94);
      border: 1px solid var(--line);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 14px;
      padding: 14px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "input input"
        "settings submit";
      column-gap: 18px;
      row-gap: 10px;
      box-shadow: 0 16px 44px rgba(0, 0, 0, 0.4);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .capsule-bar:focus-within {
      border-color: var(--line-strong);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
    }

    .capsule-input-wrap {
      grid-area: input;
      position: relative;
      display: flex;
      align-items: flex-start;
    }
    textarea.capsule-input {
      width: 100%;
      height: 32px;
      min-height: 32px;
      max-height: 96px;
      resize: none;
      background: transparent;
      border: none;
      outline: none;
      color: var(--ink);
      font-size: 14.5px;
      line-height: 1.45;
      padding: 4px 56px 4px 2px;
      scrollbar-width: none;
    }
    textarea.capsule-input::-webkit-scrollbar {
      display: none;
    }
    textarea.capsule-input::placeholder {
      color: var(--faint);
    }
    .capsule-counter {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--muted);
      position: absolute;
      right: 2px;
      bottom: 7px;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .capsule-input-wrap:has(.capsule-input:not(:placeholder-shown)) .capsule-counter {
      opacity: 1;
    }

    /* Inline Selectors */
    .capsule-selectors {
      grid-area: settings;
      display: flex;
      align-items: center;
      gap: 22px;
      min-width: 0;
    }
    .capsule-select-group {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .capsule-select-label {
      color: var(--muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .help-mark {
      position: relative;
      display: inline-grid;
      width: 15px;
      height: 15px;
      place-items: center;
      border: 1px solid var(--line);
      border-radius: 50%;
      color: var(--muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      cursor: help;
    }
    .help-mark::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 10px);
      left: 0;
      z-index: 80;
      width: max-content;
      max-width: min(240px, 72vw);
      padding: 9px 11px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #18181c;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      color: var(--ink-dim);
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 400;
      line-height: 1.45;
      letter-spacing: 0;
      text-transform: none;
      white-space: normal;
      opacity: 0;
      pointer-events: none;
      transform: translateY(4px);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .capsule-select-group:last-child .help-mark::after {
      right: 0;
      left: auto;
    }
    .capsule-select-group:hover .help-mark::after,
    .capsule-select-group:focus-within .help-mark::after,
    .help-mark:hover::after,
    .help-mark:focus::after {
      opacity: 1;
      transform: translateY(0);
    }
    .help-mark:focus-visible {
      outline: 1px solid var(--ink-dim);
      outline-offset: 3px;
    }
    .capsule-select-group select {
      border: none;
      background: transparent;
      color: var(--ink-dim);
      font-size: 11px;
      outline: none;
      cursor: pointer;
    }
    .capsule-select-group select option {
      background: #141519;
      color: var(--ink);
    }

    /* Circular Play/Generate CTA Button (Like Saloon Player) */
    .btn-capsule-play {
      grid-area: submit;
      width: 40px;
      height: 40px;
      min-width: 40px;
      border-radius: 50%;
      background: var(--accent);
      border: none;
      color: var(--accent-text);
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: transform 0.15s ease, background-color 0.15s ease, opacity 0.15s ease;
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
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    /* Inline result error */
    .inline-error {
      display: none;
      width: min(var(--content-width), 100%);
      margin-top: 4px;
      padding: 14px 0 14px 16px;
      border-left: 1px solid #d3a2a2;
      color: #d8b9b9;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }
    .inline-error.show {
      display: block;
      animation: fadeIn 0.25s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      .hud-top { padding-top: 18px; }
      .stage-container { padding-bottom: 170px; }
      body.conversation-active .stage-container { padding-top: 78px; }
      .user-turn { margin-bottom: 24px; }
      .metadata-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        row-gap: 16px;
      }
      .capsule-bar {
        padding: 12px;
      }
      .capsule-selectors {
        gap: 14px;
      }
      .result-summary {
        align-items: flex-start;
      }
    }
    @media (max-height: 700px) {
      body:not(.conversation-active) .hero-canvas {
        transform: translate(-50%, -56%) scale(0.72);
      }
      body.conversation-active .stage-container { padding-top: 72px; }
      body.conversation-active .user-turn { margin-bottom: 22px; }
      .dock-container { bottom: 14px; }
    }
    @media (max-width: 480px) {
      .presets-dock { gap: 14px; }
      .capsule-select-label { display: none; }
      .capsule-selectors { gap: 10px; }
      .result-summary {
        flex-direction: column;
        gap: 14px;
      }
      .result-actions { gap: 22px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        scroll-behavior: auto !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
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

    <!-- Submitted Prompt -->
    <div class="user-turn" id="submittedTurn">
      <div class="user-message">
        <span class="user-message-label">Creative brief</span>
        <p id="submittedPrompt"></p>
      </div>
    </div>

    <!-- Progress State -->
    <div class="progress-box" id="progress" role="status" aria-live="polite">
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

    <div class="inline-error" id="error" role="alert"></div>

    <!-- Video Output Player -->
    <div class="player-wrap" id="playerWrap">
      <video id="video" controls loop playsinline aria-label="Generated motion video"></video>

      <div class="result-details" id="result" aria-label="Generation details">
        <dl class="metadata-row">
          <div class="metadata-item"><dt>Quality score</dt><dd id="score">—</dd></div>
          <div class="metadata-item"><dt>Duration</dt><dd id="duration">—</dd></div>
          <div class="metadata-item"><dt>Format</dt><dd id="format">—</dd></div>
          <div class="metadata-item"><dt>Render time</dt><dd id="latency">—</dd></div>
        </dl>
        <div class="result-summary">
          <div class="quality-summary">
            <span class="quality-dot" aria-hidden="true"></span>
            <span id="gates">Quality checks passed</span>
          </div>
          <div class="result-actions">
            <a class="text-action" id="download" download>Download MP4</a>
            <button class="text-action" id="details" type="button">Copy MotionSpec</button>
          </div>
        </div>
      </div>
    </div>

  </main>

  <!-- Prompt composer -->
  <footer class="dock-container">
    
    <!-- Floating Presets -->
    <div class="presets-dock">
      <button class="preset-pill" type="button" data-preset="hero">Hero Title</button>
      <button class="preset-pill" type="button" data-preset="product">Product Launch</button>
      <button class="preset-pill" type="button" data-preset="metric">Metric Reveal</button>
      <button class="preset-pill" type="button" data-preset="event">Kinetic Event</button>
    </div>

    <!-- Main composer -->
    <form class="capsule-bar" id="form">
      <div class="capsule-input-wrap">
        <textarea class="capsule-input" id="prompt" maxlength="600" required rows="1" aria-label="Creative motion brief" placeholder="Describe your motion piece…"></textarea>
        <span class="capsule-counter"><span id="count">0</span>/600</span>
      </div>

      <div class="capsule-selectors">
        <label class="capsule-select-group">
          <span class="capsule-select-label">Candidates:</span>
          <span class="help-mark" tabindex="0" aria-label="Candidate options help" data-tooltip="Fast creates 1 option. Recommended compares 2 for a balance of speed and quality. Explore compares 3 for more variety, but takes longer.">?</span>
          <select id="candidates">
            <option value="1">Fast</option>
            <option value="2" selected>Recommended</option>
            <option value="3">Explore</option>
          </select>
        </label>
        <label class="capsule-select-group">
          <span class="capsule-select-label">Seed:</span>
          <span class="help-mark" tabindex="0" aria-label="Seed options help" data-tooltip="Demo repeatable uses the same seed for consistent results. Fresh variation chooses a new seed each time for different outcomes.">?</span>
          <select id="seed">
            <option value="20261001" selected>Demo repeatable</option>
            <option value="random">Fresh variation</option>
          </select>
        </label>
      </div>

      <!-- Play / Generate Button -->
      <button class="btn-capsule-play" id="generate" type="submit" title="Generate motion piece" aria-label="Generate motion piece">
        <svg viewBox="0 0 24 24">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
    </form>

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
  hero: 'Create a 6-second kinetic title. Exact copy: TURN STATIC INTO SIGNAL. Style direction: warm ivory on deep charcoal with one coral accent, measured motion, and no extra text.',
  product: 'Create a polished 7-second product announcement. Exact copy: NORTHSTAR NOTES / Ideas, finally in focus. Style direction: midnight blue, icy cyan, and restrained depth.',
  metric: 'Create an 8-second metric reveal. Exact copy: FASTER ITERATION / 63% / LESS REVIEW TIME. Style direction: make the number dominant with deep plum and pale pink.',
  event: 'Create a kinetic event card. Exact copy: MOTION NORTH / NOVEMBER 8–9 / HELSINKI. Style direction: architectural type, cold blue, white, and a subtle grid rhythm.'
};

const form = document.getElementById('form');
const prompt = document.getElementById('prompt');
const button = document.getElementById('generate');
const submittedTurn = document.getElementById('submittedTurn');
const submittedPrompt = document.getElementById('submittedPrompt');
const progress = document.getElementById('progress');
const playerWrap = document.getElementById('playerWrap');
const video = document.getElementById('video');
const result = document.getElementById('result');
const error = document.getElementById('error');
let latestSpec = null;
let timerHandle = null;

// Auto-expand textarea slightly
prompt.addEventListener('input', function() {
  document.getElementById('count').textContent = prompt.value.length;
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 96) + 'px';
});

document.querySelectorAll('[data-preset]').forEach(function(item) {
  item.addEventListener('click', function() {
    prompt.value = presets[item.dataset.preset];
    document.getElementById('count').textContent = prompt.value.length;
    prompt.style.height = 'auto';
    prompt.style.height = Math.min(prompt.scrollHeight, 96) + 'px';
    prompt.focus();
  });
});

document.getElementById('details').addEventListener('click', async function() {
  if (!latestSpec) return;
  await navigator.clipboard.writeText(JSON.stringify(latestSpec, null, 2));
  this.textContent = 'Copied';
  setTimeout(() => { this.textContent = 'Copy MotionSpec'; }, 1400);
});

function beginProgress() {
  playerWrap.style.display = 'none';
  video.style.display = 'none';
  result.classList.remove('show');
  progress.classList.add('active');
  error.classList.remove('show');
  document.getElementById('timer').textContent = '0:00';
  document.getElementById('progressText').textContent = 'Composing initial frame…';
  document.getElementById('step1').classList.add('on');
  document.getElementById('step2').classList.remove('on');
  document.getElementById('step3').classList.remove('on');
  button.disabled = true;
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
  const requestPrompt = prompt.value.trim();
  if (!requestPrompt) return;
  submittedPrompt.textContent = requestPrompt;
  submittedTurn.classList.add('show');
  document.body.classList.add('conversation-active');
  prompt.value = '';
  prompt.style.height = '32px';
  document.getElementById('count').textContent = '0';
  beginProgress();
  const seedValue = document.getElementById('seed').value;
  try {
    const response = await fetch('/generate', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        prompt: requestPrompt,
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
    const gateEntries = Object.entries(body.winner.evaluation.hardGates);
    const passedGates = gateEntries.filter(function(entry) { return entry[1] === true; }).length;
    gates.textContent = passedGates + '/' + gateEntries.length + ' quality checks passed';
    gates.title = gateEntries
      .map(function(entry) {
        return (entry[1] ? 'Passed: ' : 'Failed: ') +
          entry[0].replace(/([A-Z])/g, ' $1').toLowerCase();
      })
      .join('\\n');
    document.getElementById('download').href = body.videoUrl;
    result.classList.add('show');
    requestAnimationFrame(function() {
      playerWrap.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    });
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : String(cause);
    error.classList.add('show');
    requestAnimationFrame(function() {
      error.scrollIntoView({behavior: 'smooth', block: 'center'});
    });
  } finally {
    finishProgress();
  }
});
</script>
</body>
</html>`;
