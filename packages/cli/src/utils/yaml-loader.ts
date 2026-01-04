import * as fs from 'fs';
import * as yaml from 'yaml';
import { ZodError } from 'zod';
import type { ZodType } from 'zod';

function formatIssuePath(pathSegments: Array<string | number | symbol>): string {
  if (pathSegments.length === 0) {
    return '<root>';
  }

  const joined = pathSegments
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : String(segment)))
    .join('.');

  return joined.replace('.[', '[');
}

function buildErrorMessage(filePath: string, error: ZodError): string {
  const lines = error.issues.map((issue) => {
    const fieldPath = formatIssuePath(issue.path);
    return `- ${fieldPath}: ${issue.message}`;
  });

  return `Invalid YAML in ${filePath}:\n${lines.join('\n')}`;
}

export function loadYAML<T>(filePath: string, schema: ZodType<T>): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`YAML file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.parse(content);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new Error(buildErrorMessage(filePath, result.error));
  }

  return result.data;
}

export function saveYAML<T>(filePath: string, data: T, schema: ZodType<T>): void {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new Error(buildErrorMessage(filePath, result.error));
  }

  const content = yaml.stringify(result.data);
  fs.writeFileSync(filePath, content, 'utf-8');
}
