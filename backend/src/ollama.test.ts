import {describe, expect, it} from 'vitest';
import {normalizeCandidate, validateContentPolicy} from './ollama';

const candidate = (lines: string[]) => ({
  segments: [{lines: lines.map((text) => ({text}))}],
});

describe('validateContentPolicy', () => {
  it('accepts words present in an exact-copy request', () => {
    expect(
      validateContentPolicy({
        request:
          'Launch Foundry. Exact copy: Intelligence stays with you. Private local AI.',
        value: candidate([
          'FOUNDRY',
          'INTELLIGENCE STAYS WITH YOU',
          'PRIVATE LOCAL AI',
        ]),
      }),
    ).toEqual([]);
  });

  it('rejects invented text for an exact-copy request', () => {
    const issues = validateContentPolicy({
      request: 'Exact copy: Intelligence stays with you.',
      value: candidate(['INTELLIGENCE STAYS WITH YOU', 'EXPLORE THE FUTURE']),
    });

    expect(issues.join(' ')).toContain('invent');
  });

  it('rejects style directions rendered as copy', () => {
    const issues = validateContentPolicy({
      request:
        'Exact copy: Intelligence stays with you. Use dark navy with a cyan accent.',
      value: candidate(['INTELLIGENCE STAYS WITH YOU', 'DARK NAVY', 'CYAN ACCENT']),
    });

    expect(issues.join(' ')).toContain('style directions');
  });

  it('rejects changes to explicit copy line boundaries', () => {
    const issues = validateContentPolicy({
      request:
        'Exact copy: JAIPUR · 6 AM / FIRST LIGHT / A sunrise walk. Style direction: geometric coral.',
      value: candidate([
        'JAIPUR',
        '6 AM / FIRST LIGHT',
        'A sunrise walk',
      ]),
    });

    expect(issues.join(' ')).toContain('line boundaries');
  });

  it('removes style copy and reconciles deterministic timing', () => {
    const result = normalizeCandidate({
      durationInFrames: 300,
      accent: {type: 'none', intensity: 1},
      typography: {tracking: 0.2},
      segments: [
        {
          id: 'title',
          startFrame: 10,
          durationInFrames: 150,
          lines: [
            {text: 'MAKE IDEAS MOVE'},
            {text: 'Dark editorial style with an orange accent'},
          ],
        },
      ],
    });
    const value = result.value as {
      durationInFrames: number;
      accent: {intensity: number};
      typography: {tracking: number};
      segments: Array<{startFrame: number; lines: unknown[]}>;
    };

    expect(value.durationInFrames).toBe(150);
    expect(value.accent.intensity).toBe(0);
    expect(value.typography.tracking).toBe(0.08);
    expect(value.segments[0].startFrame).toBe(0);
    expect(value.segments[0].lines).toHaveLength(1);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('canonicalizes short metric segments', () => {
    const result = normalizeCandidate({
      durationInFrames: 60,
      segments: [
        {
          id: 'metric',
          kind: 'metric',
          startFrame: 0,
          durationInFrames: 60,
          lines: [
            {role: 'title', text: '2.4M'},
            {role: 'body', text: 'moments created'},
          ],
        },
      ],
    });
    const value = result.value as {
      durationInFrames: number;
      segments: Array<{
        durationInFrames: number;
        lines: Array<{role: string}>;
      }>;
    };

    expect(value.durationInFrames).toBe(90);
    expect(value.segments[0].durationInFrames).toBe(90);
    expect(value.segments[0].lines[0].role).toBe('metric');
  });
});
