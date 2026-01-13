import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import * as yaml from 'yaml';
import type { ZodType } from 'zod';
import type { DependencyGraph } from '../analyzer/graph.js';
import type { ConventionsDetectionInput } from '../analyzer/conventions-detector.js';
import { saveYAML } from './yaml-loader.js';

const SCAN_IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.featuremap/**',
];

export function findPackageJsonPaths(projectRoot: string): string[] {
  const results = fg.sync('**/package.json', {
    cwd: projectRoot,
    absolute: true,
    onlyFiles: true,
    ignore: SCAN_IGNORES,
  });

  results.sort((a, b) => a.localeCompare(b));
  return results;
}

export function findGoModPaths(projectRoot: string): string[] {
  const results = fg.sync('**/go.mod', {
    cwd: projectRoot,
    absolute: true,
    onlyFiles: true,
    ignore: SCAN_IGNORES,
  });

  results.sort((a, b) => a.localeCompare(b));
  return results;
}

export function countFeatureFiles(featuremapDir: string): number {
  const featuresDir = path.join(featuremapDir, 'features');
  if (!fs.existsSync(featuresDir)) {
    return 0;
  }

  const entries = fs.readdirSync(featuresDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.yaml')).length;
}

export function buildConventionsInput(graph: DependencyGraph): ConventionsDetectionInput {
  const files = Object.keys(graph.files).sort((a, b) => a.localeCompare(b));
  const exports: ConventionsDetectionInput['exports'] = [];
  const imports: ConventionsDetectionInput['imports'] = [];

  for (const [filePath, fileNode] of Object.entries(graph.files)) {
    for (const exportEntry of fileNode.exports) {
      exports.push({
        file: filePath,
        name: exportEntry.name,
        type: exportEntry.type,
      });
    }

    for (const specifier of fileNode.imports.internal) {
      imports.push({ file: filePath, specifier });
    }

    for (const specifier of fileNode.imports.external) {
      imports.push({ file: filePath, specifier });
    }
  }

  return { files, exports, imports };
}

export function saveAutoContext<T extends { detectedAt?: string }>(
  filePath: string,
  data: T,
  schema: ZodType<T>
): boolean {
  const next = schema.parse(data);
  const existing = loadAutoContext(filePath, schema);

  if (
    existing &&
    deepEqual(
      stripUndefinedDeep(stripDetectedAt(existing)),
      stripUndefinedDeep(stripDetectedAt(next))
    )
  ) {
    return false;
  }

  saveYAML(filePath, next, schema);
  return true;
}

function loadAutoContext<T>(filePath: string, schema: ZodType<T>): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.parse(content);
    if (parsed && typeof parsed === 'object' && 'source' in parsed) {
      if ((parsed as { source?: unknown }).source !== 'auto') {
        return null;
      }
      const result = schema.safeParse(parsed);
      return result.success ? result.data : null;
    }
  } catch {
    return null;
  }

  return null;
}

function stripDetectedAt<T extends { detectedAt?: string }>(value: T): Omit<T, 'detectedAt'> {
  const { detectedAt: _ignored, ...rest } = value;
  return rest;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefinedDeep(entry)]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (left === null || right === null) {
    return left === right;
  }

  if (Array.isArray(left)) {
    if (!Array.isArray(right)) {
      return false;
    }

    if (left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => deepEqual(value, right[index]));
  }

  if (typeof left === 'object') {
    if (typeof right !== 'object') {
      return false;
    }

    const leftKeys = Object.keys(left as Record<string, unknown>).sort();
    const rightKeys = Object.keys(right as Record<string, unknown>).sort();

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (let index = 0; index < leftKeys.length; index += 1) {
      const key = leftKeys[index];
      if (key !== rightKeys[index]) {
        return false;
      }

      const leftValue = (left as Record<string, unknown>)[key];
      const rightValue = (right as Record<string, unknown>)[key];
      if (!deepEqual(leftValue, rightValue)) {
        return false;
      }
    }

    return true;
  }

  return false;
}
