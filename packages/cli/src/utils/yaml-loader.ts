import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { ZodError } from 'zod';
import type { Pair } from 'yaml';
import type { ZodType } from 'zod';
import type { FileType } from '../constants/versions.js';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import { getKeyComparator } from './yaml-key-order.js';
import { checkVersion, VersionCheckError } from './version-checker.js';

export interface YAMLWriteOptions {
  sortArrayFields?: string[];
  atomicWrite?: boolean;
}

export interface LoadYAMLOptions {
  fileType?: FileType;
  skipVersionCheck?: boolean;
  allowMissingVersion?: boolean;
  onVersionInjected?: (version: number) => void;
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

function getVersionValue(value: unknown): number | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const version = value.version;
  return typeof version === 'number' && Number.isFinite(version) ? version : undefined;
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

  if (baseName === 'layout.yaml') {
    return 'layout';
  }

  if (normalized.includes('/features/')) {
    return 'feature';
  }

  if (normalized.includes('/clusters/')) {
    return 'cluster';
  }

  if (normalized.includes('/groups/')) {
    return 'group';
  }

  if (normalized.includes('/comments/')) {
    return 'comment';
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

export function loadYAML<T>(
  filePath: string,
  schema: ZodType<T>,
  options: LoadYAMLOptions = {}
): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`YAML file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.parse(content);

  const fileType = options.fileType;
  let version = getVersionValue(parsed);

  if (fileType && options.allowMissingVersion && version === undefined && isPlainObject(parsed)) {
    const fallback = SUPPORTED_VERSIONS[fileType];
    parsed.version = fallback;
    version = fallback;
    options.onVersionInjected?.(fallback);
  }

  if (fileType && !options.skipVersionCheck) {
    const result = checkVersion(fileType, version);
    if (!result.valid) {
      throw new VersionCheckError(result);
    }
  }

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

export function writeYamlTemplate(filePath: string, content: string): void {
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  atomicWriteFile(filePath, normalized);
}
