import { z } from 'zod';
import {
  ConventionsSchema,
  type ContextData,
  type ContextFile,
  ConstraintsSchema,
  DecisionsSchema,
  DesignSystemSchema,
  OverviewSchema,
  TechStackSchema,
} from './contextTypes';
import { parseYamlWithSchema } from './yamlParsing';

const DATA_BASE_URL = '/featuremap-data';

type ContextKey = keyof ContextData;

const CONTEXT_FILES: Array<{
  key: ContextKey;
  filename: string;
  schema: z.ZodTypeAny;
}> = [
  { key: 'techStack', filename: 'tech-stack.yaml', schema: TechStackSchema },
  { key: 'conventions', filename: 'conventions.yaml', schema: ConventionsSchema },
  { key: 'decisions', filename: 'decisions.yaml', schema: DecisionsSchema },
  { key: 'constraints', filename: 'constraints.yaml', schema: ConstraintsSchema },
  { key: 'overview', filename: 'overview.yaml', schema: OverviewSchema },
  { key: 'designSystem', filename: 'design-system.yaml', schema: DesignSystemSchema },
];

export async function loadContextFiles(): Promise<ContextData> {
  const entries = await Promise.all(CONTEXT_FILES.map((entry) => loadContextFile(entry)));
  const result: Record<ContextKey, ContextFile<unknown>> = {
    techStack: { status: 'missing' },
    conventions: { status: 'missing' },
    decisions: { status: 'missing' },
    constraints: { status: 'missing' },
    overview: { status: 'missing' },
    designSystem: { status: 'missing' },
  };

  for (const entry of entries) {
    result[entry.key] = entry.value;
  }

  return result as ContextData;
}

async function loadContextFile(entry: {
  key: ContextKey;
  filename: string;
  schema: z.ZodTypeAny;
}): Promise<{ key: ContextKey; value: ContextFile<unknown> }> {
  const response = await fetch(`${DATA_BASE_URL}/context/${entry.filename}`);

  if (response.status === 404) {
    return { key: entry.key, value: { status: 'missing' } };
  }

  if (!response.ok) {
    return {
      key: entry.key,
      value: { status: 'invalid', error: `Failed to load ${entry.filename}` },
    };
  }

  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();
  if (contentType.includes('text/html') && looksLikeHtml(raw)) {
    return { key: entry.key, value: { status: 'missing' } };
  }

  try {
    const data = parseYamlWithSchema(raw, entry.schema, `context/${entry.filename}`);
    return { key: entry.key, value: { status: 'present', raw, data } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid YAML';
    return {
      key: entry.key,
      value: { status: 'invalid', raw, error: message },
    };
  }
}

function looksLikeHtml(raw: string): boolean {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
}
