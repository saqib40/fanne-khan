import {z} from 'zod';
import {
  type MotionSpec,
  motionSpecSchema,
} from '../../frontend/src/schema/motion-spec';
import {
  MOTION_DESIGN_SYSTEM_PROMPT,
  createRepairPrompt,
  createUserPrompt,
} from './prompt';

const ollamaResponseSchema = z.object({
  message: z.object({
    content: z.string(),
  }),
  total_duration: z.number().optional(),
  eval_count: z.number().optional(),
});

export type GenerationAttempt = {
  spec: MotionSpec | null;
  raw: string;
  repaired: boolean;
  normalized: string[];
  issues: string[];
  elapsedSeconds: number;
  outputTokens?: number;
};

const schema = z.toJSONSchema(motionSpecSchema);
const modelBackendSchema = z.enum(['unsloth', 'ollama']);
export type ModelBackend = z.infer<typeof modelBackendSchema>;

const modelBackend = (): ModelBackend =>
  modelBackendSchema.parse(process.env.MODEL_BACKEND ?? 'unsloth');

const isStyleDirectionLine = (line: string): boolean =>
  /\b(landscape|portrait|square|palette|typography|style|3d accent|accent color|[a-z]+ accent|with (?:an?|the) [a-z]+ accent)\b/i.test(
    line,
  );

export const normalizeCandidate = (
  input: unknown,
): {value: unknown; actions: string[]} => {
  const value = structuredClone(input);
  const actions: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {value, actions};
  }
  const root = value as Record<string, unknown>;
  const typography = root.typography;
  if (typography && typeof typography === 'object' && !Array.isArray(typography)) {
    const record = typography as Record<string, unknown>;
    if (typeof record.tracking === 'number') {
      const tracking = Math.max(-0.06, Math.min(0.08, record.tracking));
      if (tracking !== record.tracking) {
        record.tracking = tracking;
        actions.push('clamped typography tracking');
      }
    }
  }

  const accent = root.accent;
  if (accent && typeof accent === 'object' && !Array.isArray(accent)) {
    const record = accent as Record<string, unknown>;
    if (record.type === 'none' && record.intensity !== 0) {
      record.intensity = 0;
      actions.push('zeroed disabled accent intensity');
    } else if (
      typeof record.intensity === 'number' &&
      record.intensity > 0.8
    ) {
      record.intensity = 0.8;
      actions.push('clamped accent intensity');
    }
  }

  if (!Array.isArray(root.segments)) {
    return {value, actions};
  }
  const segments = root.segments.filter(
    (segment): segment is Record<string, unknown> =>
      Boolean(segment) && typeof segment === 'object' && !Array.isArray(segment),
  );
  for (const segment of segments) {
    if (!Array.isArray(segment.lines)) {
      continue;
    }
    const lines = segment.lines;
    const filteredLines = lines.filter((line) => {
      if (!line || typeof line !== 'object' || Array.isArray(line)) {
        return true;
      }
      const text = (line as Record<string, unknown>).text;
      return typeof text !== 'string' || !isStyleDirectionLine(text);
    });
    segment.lines = filteredLines;
    if (filteredLines.length !== lines.length) {
      actions.push(`removed style copy from ${String(segment.id ?? 'segment')}`);
    }
  }
  root.segments = segments.filter(
    (segment) => !Array.isArray(segment.lines) || segment.lines.length > 0,
  );

  for (const segment of root.segments as Record<string, unknown>[]) {
    if (segment.kind !== 'metric' || !Array.isArray(segment.lines)) {
      continue;
    }
    const numericLines = segment.lines.filter((line) => {
      if (!line || typeof line !== 'object' || Array.isArray(line)) {
        return false;
      }
      const text = (line as Record<string, unknown>).text;
      return typeof text === 'string' && /[0-9%+]/.test(text);
    });
    if (numericLines.length === 1) {
      for (const line of segment.lines) {
        if (!line || typeof line !== 'object' || Array.isArray(line)) {
          continue;
        }
        const record = line as Record<string, unknown>;
        if (line === numericLines[0] && record.role !== 'metric') {
          record.role = 'metric';
          actions.push('assigned numeric line to metric role');
        } else if (line !== numericLines[0] && record.role === 'metric') {
          record.role = 'subtitle';
          actions.push('reserved metric role for numeric line');
        }
      }
    }
  }

  let cursor = 0;
  let timingsAreNumeric = true;
  for (const segment of root.segments as Record<string, unknown>[]) {
    if (typeof segment.durationInFrames !== 'number') {
      timingsAreNumeric = false;
      break;
    }
    if (segment.startFrame !== cursor) {
      segment.startFrame = cursor;
      actions.push('reconciled segment timeline');
    }
    cursor += segment.durationInFrames;
  }
  if (timingsAreNumeric && cursor > 0 && cursor < 90) {
    const last = (root.segments as Record<string, unknown>[]).at(-1);
    if (last && typeof last.durationInFrames === 'number') {
      last.durationInFrames += 90 - cursor;
      cursor = 90;
      actions.push('extended timeline to minimum duration');
    }
  }
  if (
    timingsAreNumeric &&
    cursor >= 90 &&
    cursor <= 360 &&
    root.durationInFrames !== cursor
  ) {
    root.durationInFrames = cursor;
    actions.push('matched composition duration to segments');
  }

  return {value, actions: [...new Set(actions)]};
};

const parseCandidate = (
  content: string,
): {
  spec: MotionSpec | null;
  value: unknown;
  issues: string[];
  normalized: string[];
} => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return {
      spec: null,
      value: null,
      normalized: [],
      issues: [
        `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  const normalized = normalizeCandidate(parsed);
  const result = motionSpecSchema.safeParse(normalized.value);
  if (result.success) {
    return {
      spec: result.data,
      value: normalized.value,
      issues: [],
      normalized: normalized.actions,
    };
  }
  return {
    spec: null,
    value: normalized.value,
    normalized: normalized.actions,
    issues: result.error.issues.map(
      (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`,
    ),
  };
};

const contentShapeSchema = z.object({
  segments: z.array(
    z.object({
      lines: z.array(z.object({text: z.string()})),
    }),
  ),
});

const words = (text: string): Set<string> =>
  new Set(text.toLowerCase().match(/[a-z0-9%+]+/g) ?? []);

export const validateContentPolicy = ({
  request,
  value,
}: {
  request: string;
  value: unknown;
}): string[] => {
  const shaped = contentShapeSchema.safeParse(value);
  if (!shaped.success) {
    return [];
  }

  const issues: string[] = [];
  const requestWords = words(request);
  const textLines = shaped.data.segments.flatMap((segment) =>
    segment.lines.map((line) => line.text),
  );
  const styleLeak = textLines.filter(isStyleDirectionLine);
  if (styleLeak.length > 0) {
    issues.push(
      `Content policy: style directions became on-screen copy (${styleLeak.join(' / ')})`,
    );
  }

  if (!/\b(?:exact copy|copy)\s*:|\breading\b/i.test(request)) {
    return issues;
  }

  const outputWords = words(textLines.join(' '));
  const ignoredNovelWords = new Set(['and', 'by', 'for', 'of', 'the', 'to']);
  const invented = [...outputWords].filter(
    (word) => !requestWords.has(word) && !ignoredNovelWords.has(word),
  );
  if (invented.length > 0) {
    issues.push(
      `Content policy: do not invent on-screen words (${invented.join(', ')})`,
    );
  }

  const exactCopyMatch = request.match(
    /\bexact copy\s*:\s*(.*?)(?=\.\s*style direction\s*:|$)/i,
  );
  if (exactCopyMatch?.[1].includes('/')) {
    const expectedLines = exactCopyMatch[1]
      .split(/\s+\/\s+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const missingLines = expectedLines.filter(
      (expected) => !textLines.includes(expected),
    );
    const unexpectedLines = textLines.filter(
      (rendered) => !expectedLines.includes(rendered),
    );
    if (missingLines.length > 0 || unexpectedLines.length > 0) {
      issues.push(
        `Content policy: preserve exact copy line boundaries` +
          ` (missing: ${missingLines.join(' / ') || 'none'};` +
          ` unexpected: ${unexpectedLines.join(' / ') || 'none'})`,
      );
    }
  }

  return issues;
};

const chat = async ({
  messages,
  seed,
  temperature,
}: {
  messages: Array<{role: 'system' | 'user'; content: string}>;
  seed: number;
  temperature: number;
}) => {
  if (modelBackend() === 'unsloth') {
    const baseUrl =
      process.env.INFERENCE_URL ?? 'http://127.0.0.1:8788';
    const response = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        messages,
        seed,
        temperature,
        maxNewTokens: 400,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) {
      throw new Error(
        `Unsloth sidecar returned ${response.status}: ${await response.text()}`,
      );
    }
    return ollamaResponseSchema.parse(await response.json());
  }

  const baseUrl = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b';
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      format: schema,
      keep_alive: '15m',
      options: {
        seed,
        temperature,
        num_ctx: 4096,
        num_predict: 1800,
        top_p: 0.9,
      },
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama returned ${response.status}: ${await response.text()}`,
    );
  }
  return ollamaResponseSchema.parse(await response.json());
};

export const generateMotionSpec = async ({
  request,
  seed,
  temperature,
}: {
  request: string;
  seed: number;
  temperature: number;
}): Promise<GenerationAttempt> => {
  const startedAt = performance.now();
  const first = await chat({
    messages: [
      {role: 'system', content: MOTION_DESIGN_SYSTEM_PROMPT},
      {role: 'user', content: createUserPrompt(request)},
    ],
    seed,
    temperature,
  });
  const initial = parseCandidate(first.message.content);
  const initialIssues = [
    ...initial.issues,
    ...validateContentPolicy({request, value: initial.value}),
  ];

  if (initial.spec && initialIssues.length === 0) {
    return {
      spec: initial.spec,
      raw: first.message.content,
      repaired: false,
      normalized: initial.normalized,
      issues: [],
      elapsedSeconds: (performance.now() - startedAt) / 1000,
      outputTokens: first.eval_count,
    };
  }

  const repaired = await chat({
    messages: [
      {role: 'system', content: MOTION_DESIGN_SYSTEM_PROMPT},
      {
        role: 'user',
        content: createRepairPrompt({
          request,
          invalidOutput: first.message.content,
          issues: initialIssues,
        }),
      },
    ],
    seed: seed + 10_000,
    temperature: 0.2,
  });
  const final = parseCandidate(repaired.message.content);
  const finalIssues = [
    ...final.issues,
    ...validateContentPolicy({request, value: final.value}),
  ];

  return {
    spec: finalIssues.length === 0 ? final.spec : null,
    raw: repaired.message.content,
    repaired: true,
    normalized: final.normalized,
    issues: finalIssues,
    elapsedSeconds: (performance.now() - startedAt) / 1000,
    outputTokens: (first.eval_count ?? 0) + (repaired.eval_count ?? 0),
  };
};

export const checkModelRuntime = async (): Promise<{
  available: boolean;
  model: string;
  installed: boolean;
  backend: ModelBackend;
}> => {
  const backend = modelBackend();
  if (backend === 'unsloth') {
    const baseUrl =
      process.env.INFERENCE_URL ?? 'http://127.0.0.1:8788';
    const configuredAdapter =
      process.env.ADAPTER_DIR ?? 'training/runs/dpo-taste/adapter';
    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) {
        return {
          available: false,
          model: configuredAdapter,
          installed: false,
          backend,
        };
      }
      const body = z
        .object({
          status: z.literal('ready'),
          model: z.string(),
        })
        .parse(await response.json());
      return {
        available: true,
        model: body.model,
        installed: true,
        backend,
      };
    } catch {
      return {
        available: false,
        model: configuredAdapter,
        installed: false,
        backend,
      };
    }
  }

  const baseUrl = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b';
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) {
      return {available: false, model, installed: false, backend};
    }
    const body = z
      .object({models: z.array(z.object({name: z.string()}))})
      .parse(await response.json());
    return {
      available: true,
      model,
      backend,
      installed: body.models.some(
        (entry) => entry.name === model || entry.name.startsWith(`${model}:`),
      ),
    };
  } catch {
    return {available: false, model, installed: false, backend};
  }
};
