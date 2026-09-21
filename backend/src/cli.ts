import {generateBestMotion} from './generate';
import {checkModelRuntime} from './ollama';

const prompt = process.argv.slice(2).join(' ').trim();

if (!prompt) {
  console.error(
    'Usage: npm run generate -- "Kinetic launch teaser for a local AI tool"',
  );
  process.exit(1);
}

const status = await checkModelRuntime();
if (!status.available) {
  console.error(
    status.backend === 'unsloth'
      ? 'DPO inference is not reachable. Run `npm run inference:serve` first.'
      : 'Ollama is not reachable. Start it with `ollama serve` and try again.',
  );
  process.exit(1);
}
if (!status.installed) {
  console.error(
    `Model ${status.model} is not installed. Run \`ollama pull ${status.model}\`.`,
  );
  process.exit(1);
}

const result = await generateBestMotion({
  prompt,
  candidateCount: Number(process.env.CANDIDATES ?? 2),
  seed: Number(process.env.SEED ?? 20260918),
});

console.log(JSON.stringify(result, null, 2));
if (!result.winner) {
  process.exitCode = 2;
}
