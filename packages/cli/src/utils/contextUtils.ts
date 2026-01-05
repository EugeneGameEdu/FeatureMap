import * as fs from 'fs';
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

export function saveAutoContext<T>(filePath: string, data: T, schema: ZodType<T>): void {
  if (!shouldOverwriteAutoContext(filePath)) {
    return;
  }

  saveYAML(filePath, data, schema);
}

function shouldOverwriteAutoContext(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return true;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.parse(content);
    if (parsed && typeof parsed === 'object' && 'source' in parsed) {
      return (parsed as { source?: unknown }).source === 'auto';
    }
  } catch {
    return false;
  }

  return false;
}
