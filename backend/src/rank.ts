import {mkdir, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {MotionSpec} from '../../frontend/src/schema/motion-spec';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

type EvaluationReport = {
  status: 'success';
  hardGates: Record<string, {pass: boolean}>;
  temporal: {
    meanMotion: number;
    peakMotion: number;
    activeSamplePairs: number;
  };
  elapsedSeconds: number;
  outputDirectory: string;
};

export type RankedCandidate = {
  spec: MotionSpec;
  score: number;
  reasons: string[];
  evaluation: EvaluationReport;
  generation: {
    repaired: boolean;
    normalized: string[];
    elapsedSeconds: number;
    outputTokens?: number;
    seed: number;
    temperature: number;
  };
};

const runEvaluator = async (
  specPath: string,
): Promise<EvaluationReport> => {
  const executable = path.join(root, 'node_modules', '.bin', 'tsx');
  const evaluator = path.join(root, 'evaluator', 'src', 'evaluate.ts');

  return new Promise((resolve, reject) => {
    const child = spawn(executable, [evaluator], {
      cwd: root,
      env: {
        ...process.env,
        SPEC_PATH: specPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        const report = JSON.parse(stdout) as EvaluationReport;
        if (report.status !== 'success') {
          reject(new Error(`Evaluation failed: ${stdout}`));
          return;
        }
        if (code !== 0) {
          reject(new Error(`Candidate failed a hard gate: ${stdout}`));
          return;
        }
        resolve(report);
      } catch (error) {
        reject(
          new Error(
            `Could not parse evaluator output: ${
              error instanceof Error ? error.message : String(error)
            }\n${stderr}`,
          ),
        );
      }
    });
  });
};

const promptWords = (prompt: string): Set<string> => {
  const stopWords = new Set([
    'a',
    'an',
    'and',
    'for',
    'in',
    'of',
    'on',
    'the',
    'to',
    'video',
    'with',
  ]);
  return new Set(
    prompt
      .toLowerCase()
      .match(/[a-z0-9%+]+/g)
      ?.filter((word) => word.length > 2 && !stopWords.has(word)) ?? [],
  );
};

const scoreCandidate = ({
  prompt,
  spec,
  evaluation,
}: {
  prompt: string;
  spec: MotionSpec;
  evaluation: EvaluationReport;
}): {score: number; reasons: string[]} => {
  let score = 50;
  const reasons: string[] = ['passed every render hard gate'];
  const lines = spec.segments.flatMap((segment) => segment.lines);
  const outputWords = new Set(
    lines
      .flatMap((line) => line.text.toLowerCase().match(/[a-z0-9%+]+/g) ?? []),
  );
  const requestedWords = promptWords(prompt);
  const covered = [...requestedWords].filter((word) => outputWords.has(word));
  const coverage =
    requestedWords.size === 0 ? 1 : covered.length / requestedWords.size;
  score += coverage * 20;
  reasons.push(`literal prompt coverage ${Math.round(coverage * 100)}%`);

  const hasDisplayLine = lines.some(
    (line) => line.role === 'title' || line.role === 'metric',
  );
  const hasSupportingLine = lines.some((line) =>
    ['eyebrow', 'subtitle', 'body'].includes(line.role),
  );
  if (hasDisplayLine && hasSupportingLine) {
    score += 10;
    reasons.push('clear display/supporting hierarchy');
  }

  const emphasisCount = lines.filter((line) => line.emphasis).length;
  if (emphasisCount >= 1 && emphasisCount <= spec.segments.length + 1) {
    score += 5;
    reasons.push('restrained emphasis');
  }

  const overlongLines = lines.filter((line) => {
    const limit = line.role === 'title' || line.role === 'metric' ? 42 : 70;
    return line.text.length > limit;
  });
  if (overlongLines.length === 0) {
    score += 10;
    reasons.push('copy fits role-specific length limits');
  } else {
    score -= overlongLines.length * 8;
    reasons.push(`${overlongLines.length} overlong line(s)`);
  }

  if (spec.accent.intensity <= 0.8) {
    score += 5;
    reasons.push('3D accent remains subordinate');
  }

  return {score: Number(score.toFixed(2)), reasons};
};

export const evaluateAndRank = async ({
  prompt,
  candidates,
}: {
  prompt: string;
  candidates: Array<{
    spec: MotionSpec;
    repaired: boolean;
    normalized: string[];
    elapsedSeconds: number;
    outputTokens?: number;
    seed: number;
    temperature: number;
  }>;
}): Promise<{ranked: RankedCandidate[]; failures: string[]}> => {
  const directory = path.join(root, '.cache', 'generated');
  await mkdir(directory, {recursive: true});
  const ranked: RankedCandidate[] = [];
  const failures: string[] = [];

  for (const [index, candidate] of candidates.entries()) {
    const specPath = path.join(directory, `candidate-${index + 1}.json`);
    await writeFile(specPath, JSON.stringify(candidate.spec, null, 2));
    try {
      const evaluation = await runEvaluator(specPath);
      const scored = scoreCandidate({
        prompt,
        spec: candidate.spec,
        evaluation,
      });
      ranked.push({
        spec: candidate.spec,
        score: scored.score,
        reasons: scored.reasons,
        evaluation,
        generation: {
          repaired: candidate.repaired,
          normalized: candidate.normalized,
          elapsedSeconds: candidate.elapsedSeconds,
          outputTokens: candidate.outputTokens,
          seed: candidate.seed,
          temperature: candidate.temperature,
        },
      });
    } catch (error) {
      failures.push(
        `Candidate ${index + 1}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  ranked.sort((first, second) => second.score - first.score);
  return {ranked, failures};
};
