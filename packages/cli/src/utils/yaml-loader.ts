import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { ZodError } from 'zod';
import type { Pair } from 'yaml';
import type { ZodType } from 'zod';
import { getKeyComparator } from './yaml-key-order.js';

export interface YAMLWriteOptions {
  sortArrayFields?: string[];
  atomicWrite?: boolean;
}

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getObjectSortKey(value: Record<string, unknown>): string | null {
  if (typeof value.id === 'string') {
    return value.id;
  }

  if (typeof value.path === 'string') {
    return value.path;
  }

  if (typeof value.name === 'string') {
    return value.name;
  }

  if (typeof value.source === 'string' && typeof value.target === 'string') {
    return `${value.source}->${value.target}`;
  }

  return null;
}

function sortArrayValues(values: unknown[]): unknown[] {
  if (values.every((value) => typeof value === 'string')) {
    return [...values].sort((a, b) => (a as string).localeCompare(b as string));
  }

  if (values.every((value) => typeof value === 'number')) {
    return [...values].sort((a, b) => (a as number) - (b as number));
  }

  if (values.every(isPlainObject)) {
    const keys = values.map((value) => getObjectSortKey(value as Record<string, unknown>));

    if (keys.every((key) => key !== null)) {
      return [...values]
        .map((value, index) => ({ value, key: keys[index] as string }))
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((entry) => entry.value);
    }
  }

  return values;
}

function normalizeValue(
  value: unknown,
  sortArrayFields: Set<string>,
  currentKey?: string
): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map((entry) => normalizeValue(entry, sortArrayFields));
    return currentKey && sortArrayFields.has(currentKey)
      ? sortArrayValues(normalized)
      : normalized;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).map(([key, entry]) => [
      key,
      normalizeValue(entry, sortArrayFields, key),
    ]);
    return Object.fromEntries(entries);
  }

  return value;
}

function getTypeFromPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const baseName = path.posix.basename(normalized);

  if (baseName === 'config.yaml') {
    return 'config';
  }

  if (baseName === 'graph.yaml') {
    return 'graph';
  }

  if (normalized.includes('/features/')) {
    return 'feature';
  }

  if (normalized.includes('/clusters/')) {
    return 'cluster';
  }

  return null;
}

function atomicWriteFile(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp`;

  try {
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Best-effort cleanup only.
    }
    throw error;
  }
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

export function saveYAML<T>(
  filePath: string,
  data: T,
  schema: ZodType<T>,
  options: YAMLWriteOptions = {}
): void {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new Error(buildErrorMessage(filePath, result.error));
  }

  const sortArrayFields = new Set(options.sortArrayFields ?? []);
  const normalized = normalizeValue(result.data, sortArrayFields);
  const keyType = getTypeFromPath(filePath);
  const keyComparator = keyType ? getKeyComparator(keyType) : null;
  const sortMapEntries = keyComparator
    ? (a: Pair, b: Pair) => keyComparator(String(a.key), String(b.key))
    : undefined;

  const content = yaml.stringify(normalized, {
    sortMapEntries,
    lineWidth: 0,
  });

  if (options.atomicWrite === false) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return;
  }

  atomicWriteFile(filePath, content);
}
