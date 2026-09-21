import {z} from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Expected a six-digit hex color');

const relativeLuminance = (hex: string): number => {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(
    (value) => {
      const normalized = Number.parseInt(value, 16) / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    },
  );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

export const contrastRatio = (first: string, second: string): number => {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
};

export const textLineSchema = z.strictObject({
  role: z.enum(['eyebrow', 'title', 'subtitle', 'body', 'metric']),
  text: z.string().trim().min(1).max(90),
  emphasis: z.boolean().default(false),
});

export const segmentSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  startFrame: z.number().int().min(0),
  durationInFrames: z.number().int().min(24).max(360),
  kind: z.enum(['title', 'quote', 'product', 'metric', 'event', 'outro']),
  layout: z.enum(['center', 'left', 'split']),
  entrance: z.enum(['rise', 'fade', 'scale', 'wipe', 'stagger']),
  exit: z.enum(['fade', 'shrink', 'cut']),
  lines: z.array(textLineSchema).min(1).max(4),
});

export const motionSpecSchema = z
  .strictObject({
    version: z.literal('1.0'),
    name: z.string().trim().min(1).max(60),
    fps: z.literal(30),
    width: z.union([z.literal(1080), z.literal(1920)]),
    height: z.union([z.literal(1080), z.literal(1920)]),
    durationInFrames: z.number().int().min(90).max(360),
    palette: z.strictObject({
      background: hexColor,
      foreground: hexColor,
      accent: hexColor,
      muted: hexColor,
    }),
    typography: z.strictObject({
      display: z.enum([
        'space-grotesk',
        'inter',
        'jetbrains-mono',
        'fraunces',
      ]),
      body: z.enum(['inter', 'space-grotesk', 'jetbrains-mono']),
      tracking: z.number().min(-0.06).max(0.08),
      uppercaseTitles: z.boolean(),
    }),
    accent: z.strictObject({
      type: z.enum(['none', 'orbit', 'grid', 'particles', 'glass']),
      intensity: z.number().min(0).max(0.8),
    }),
    segments: z.array(segmentSchema).min(1).max(6),
  })
  .superRefine((spec, context) => {
    if (
      contrastRatio(spec.palette.foreground, spec.palette.background) < 4.5
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Foreground/background contrast must be at least 4.5:1',
        path: ['palette', 'foreground'],
      });
    }
    if (contrastRatio(spec.palette.accent, spec.palette.background) < 3) {
      context.addIssue({
        code: 'custom',
        message: 'Accent/background contrast must be at least 3:1',
        path: ['palette', 'accent'],
      });
    }
    if (spec.accent.type === 'none' && spec.accent.intensity !== 0) {
      context.addIssue({
        code: 'custom',
        message: 'A disabled accent must have zero intensity',
        path: ['accent', 'intensity'],
      });
    }

    const ids = new Set<string>();
    const ordered = [...spec.segments].sort(
      (a, b) => a.startFrame - b.startFrame,
    );

    for (const segment of ordered) {
      if (ids.has(segment.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate segment id: ${segment.id}`,
          path: ['segments'],
        });
      }
      ids.add(segment.id);

      if (segment.startFrame + segment.durationInFrames > spec.durationInFrames) {
        context.addIssue({
          code: 'custom',
          message: `${segment.id} extends beyond the composition`,
          path: ['segments'],
        });
      }

      const metricLines = segment.lines.filter(
        (line) => line.role === 'metric',
      );
      if (segment.kind === 'metric') {
        if (
          metricLines.length !== 1 ||
          !/[0-9%+]/.test(metricLines[0]?.text ?? '')
        ) {
          context.addIssue({
            code: 'custom',
            message:
              'Metric segments require exactly one numeric metric text line',
            path: ['segments'],
          });
        }
      } else if (metricLines.length > 0) {
        context.addIssue({
          code: 'custom',
          message: 'Metric text lines are only valid in metric segments',
          path: ['segments'],
        });
      }
    }

    if (ordered[0]?.startFrame !== 0) {
      context.addIssue({
        code: 'custom',
        message: 'The first segment must start at frame 0',
        path: ['segments'],
      });
    }

    for (let index = 1; index < ordered.length; index++) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      const previousEnd =
        previous.startFrame + previous.durationInFrames;
      if (previousEnd > current.startFrame) {
        context.addIssue({
          code: 'custom',
          message: `${previous.id} overlaps ${current.id}`,
          path: ['segments'],
        });
      } else if (previousEnd < current.startFrame) {
        context.addIssue({
          code: 'custom',
          message: `Timeline gap between ${previous.id} and ${current.id}`,
          path: ['segments'],
        });
      }
    }

    const last = ordered.at(-1);
    if (
      last &&
      last.startFrame + last.durationInFrames !== spec.durationInFrames
    ) {
      context.addIssue({
        code: 'custom',
        message: 'The final segment must end with the composition',
        path: ['segments'],
      });
    }
  });

export type MotionSpec = z.infer<typeof motionSpecSchema>;
export type MotionSegment = z.infer<typeof segmentSchema>;
export type TextLine = z.infer<typeof textLineSchema>;

export const parseMotionSpec = (value: unknown): MotionSpec =>
  motionSpecSchema.parse(value);
