import {describe, expect, it} from 'vitest';
import {fixtures} from '../fixtures';
import {motionSpecSchema} from './motion-spec';

describe('motionSpecSchema', () => {
  it('accepts every curated fixture', () => {
    for (const fixture of Object.values(fixtures)) {
      expect(motionSpecSchema.safeParse(fixture).success).toBe(true);
    }
  });

  it('rejects overlapping segments', () => {
    const fixture = structuredClone(fixtures.ProductLaunch);
    fixture.segments[1].startFrame = 140;

    const result = motionSpecSchema.safeParse(fixture);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('overlaps'))).toBe(
        true,
      );
    }
  });

  it('rejects generated fields outside the contract', () => {
    const fixture = {
      ...structuredClone(fixtures.KineticTitle),
      arbitraryJavascript: 'fetch("https://example.com")',
    };

    expect(motionSpecSchema.safeParse(fixture).success).toBe(false);
  });

  it('rejects segments that outlive the composition', () => {
    const fixture = structuredClone(fixtures.LogoOutro);
    fixture.segments[0].durationInFrames = 150;

    const result = motionSpecSchema.safeParse(fixture);

    expect(result.success).toBe(false);
  });

  it('rejects unreadable foreground and accent colors', () => {
    const fixture = structuredClone(fixtures.KineticTitle);
    fixture.palette.foreground = '#111111';
    fixture.palette.accent = '#222222';

    const result = motionSpecSchema.safeParse(fixture);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.filter((issue) =>
          issue.message.includes('contrast'),
        ),
      ).toHaveLength(2);
    }
  });

  it('rejects timeline gaps and blank tails', () => {
    const gap = structuredClone(fixtures.ProductLaunch);
    gap.segments[1].startFrame = 160;
    gap.segments[1].durationInFrames = 80;

    const blankTail = structuredClone(fixtures.LogoOutro);
    blankTail.segments[0].durationInFrames = 90;

    expect(motionSpecSchema.safeParse(gap).success).toBe(false);
    expect(motionSpecSchema.safeParse(blankTail).success).toBe(false);
  });
});
