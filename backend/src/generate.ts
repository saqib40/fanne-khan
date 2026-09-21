import {generateMotionSpec} from './ollama';
import {evaluateAndRank} from './rank';

export type GenerationResult = {
  prompt: string;
  requestedCandidates: number;
  validCandidates: number;
  generationFailures: string[];
  evaluationFailures: string[];
  winner: Awaited<ReturnType<typeof evaluateAndRank>>['ranked'][number] | null;
  alternatives: Awaited<ReturnType<typeof evaluateAndRank>>['ranked'];
  elapsedSeconds: number;
};

const temperatures = [0.45, 0.7, 0.9] as const;

export const generateBestMotion = async ({
  prompt,
  candidateCount = 2,
  seed = 20260918,
}: {
  prompt: string;
  candidateCount?: number;
  seed?: number;
}): Promise<GenerationResult> => {
  const startedAt = performance.now();
  const count = Math.max(1, Math.min(3, Math.round(candidateCount)));
  const valid = [];
  const generationFailures: string[] = [];

  for (let index = 0; index < count; index++) {
    const candidateSeed = seed + index * 997;
    const temperature = temperatures[index];
    try {
      const result = await generateMotionSpec({
        request: prompt,
        seed: candidateSeed,
        temperature,
      });
      if (!result.spec) {
        generationFailures.push(
          `Candidate ${index + 1}: ${result.issues.join('; ')}`,
        );
        continue;
      }
      valid.push({
        spec: result.spec,
        repaired: result.repaired,
        normalized: result.normalized,
        elapsedSeconds: result.elapsedSeconds,
        outputTokens: result.outputTokens,
        seed: candidateSeed,
        temperature,
      });
    } catch (error) {
      generationFailures.push(
        `Candidate ${index + 1}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const {ranked, failures: evaluationFailures} = await evaluateAndRank({
    prompt,
    candidates: valid,
  });

  return {
    prompt,
    requestedCandidates: count,
    validCandidates: valid.length,
    generationFailures,
    evaluationFailures,
    winner: ranked[0] ?? null,
    alternatives: ranked.slice(1),
    elapsedSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(2)),
  };
};
