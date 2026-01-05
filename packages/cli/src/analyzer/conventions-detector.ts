import * as path from 'path';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import type { Conventions } from '../types/context.js';

export interface ConventionsDetectionInput {
  files: string[];
  exports: Array<{ file: string; name: string; type: string }>;
  imports: Array<{ file: string; specifier: string }>;
}

const NAMING_PATTERNS: Record<string, RegExp> = {
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  'kebab-case': /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
  'snake_case': /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
  UPPER_SNAKE_CASE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
};

function detectNamingPattern(names: string[]): string | undefined {
  const counts = new Map<string, number>();

  for (const name of names) {
    for (const [patternName, regex] of Object.entries(NAMING_PATTERNS)) {
      if (regex.test(name)) {
        counts.set(patternName, (counts.get(patternName) ?? 0) + 1);
      }
    }
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }

    return a[0].localeCompare(b[0]);
  });

  return sorted.length > 0 ? sorted[0][0] : undefined;
}

function getFileNameParts(filePath: string): { baseName: string; extLabel: string } {
  const baseName = path.basename(filePath);

  if (baseName.endsWith('.types.ts')) {
    return {
      baseName: baseName.slice(0, -'.types.ts'.length),
      extLabel: '.types.ts',
    };
  }

  if (baseName.endsWith('.types.tsx')) {
    return {
      baseName: baseName.slice(0, -'.types.tsx'.length),
      extLabel: '.types.tsx',
    };
  }

  if (baseName.endsWith('.d.ts')) {
    return {
      baseName: baseName.slice(0, -'.d.ts'.length),
      extLabel: '.d.ts',
    };
  }

  const ext = path.extname(baseName);
  return {
    baseName: baseName.slice(0, -ext.length),
    extLabel: ext || '',
  };
}

function detectFilePattern(filePaths: string[], matcher: (filePath: string) => boolean): string | undefined {
  const groupedNames = new Map<string, string[]>();

  for (const filePath of filePaths) {
    if (!matcher(filePath)) {
      continue;
    }

    const { baseName, extLabel } = getFileNameParts(filePath);
    if (!baseName) {
      continue;
    }

    if (!groupedNames.has(extLabel)) {
      groupedNames.set(extLabel, []);
    }

    groupedNames.get(extLabel)?.push(baseName);
  }

  if (groupedNames.size === 0) {
    return undefined;
  }

  const sortedGroups = Array.from(groupedNames.entries()).sort((a, b) => b[1].length - a[1].length);
  const [extLabel, names] = sortedGroups[0];
  const pattern = detectNamingPattern(names);

  return pattern ? `${pattern}${extLabel}` : undefined;
}

function isComponentFile(filePath: string): boolean {
  return (
    filePath.endsWith('.tsx') ||
    filePath.endsWith('.jsx') ||
    filePath.replace(/\\/g, '/').includes('/components/')
  );
}

function isUtilsFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.includes('/utils/') || normalized.includes('/util/') || normalized.includes('/helpers/');
}

function isTypesFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('/types/') ||
    normalized.endsWith('.types.ts') ||
    normalized.endsWith('.types.tsx') ||
    normalized.endsWith('.d.ts')
  );
}

function isMeaningfulName(name: string): boolean {
  return name.length > 0 && name !== 'default' && name !== 'anonymous';
}

function detectExportPattern(
  exports: Array<{ file: string; name: string; type: string }>,
  matcher: (entry: { file: string; name: string; type: string }) => boolean
): string | undefined {
  const names = exports
    .filter(matcher)
    .map((entry) => entry.name)
    .filter(isMeaningfulName);

  return detectNamingPattern(names);
}

function compactStringMap<T extends Record<string, string | undefined>>(
  values: T
): Partial<Record<keyof T, string>> | undefined {
  const result: Partial<Record<keyof T, string>> = {};
  const entries = Object.entries(values) as Array<[keyof T, string | undefined]>;

  for (const [key, value] of entries) {
    if (typeof value === 'string' && value.length > 0) {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function classifyImportStyle(
  imports: Array<{ file: string; specifier: string }>
): Conventions['imports'] | undefined {
  let relativeCount = 0;
  let aliasCount = 0;
  let absoluteCount = 0;

  for (const entry of imports) {
    const specifier = entry.specifier;
    if (specifier.startsWith('.')) {
      relativeCount += 1;
      continue;
    }

    if (
      specifier.startsWith('@/') ||
      specifier.startsWith('~/') ||
      specifier.startsWith('#/') ||
      specifier.startsWith('$/') ||
      specifier.startsWith('src/') ||
      specifier.startsWith('app/')
    ) {
      aliasCount += 1;
      continue;
    }

    if (specifier.startsWith('/')) {
      absoluteCount += 1;
    }
  }

  if (relativeCount > 0 && (aliasCount > 0 || absoluteCount > 0)) {
    return { style: 'mixed' };
  }

  if (aliasCount > 0) {
    return { style: 'aliases' };
  }

  if (relativeCount > 0) {
    return { style: 'relative' };
  }

  if (absoluteCount > 0) {
    return { style: 'absolute' };
  }

  return undefined;
}

export function detectConventions(input: ConventionsDetectionInput): Conventions {
  const files = input.files;

  const namingFiles = compactStringMap({
    components: detectFilePattern(files, isComponentFile),
    utils: detectFilePattern(files, isUtilsFile),
    types: detectFilePattern(files, isTypesFile),
  });

  const exportConventions = compactStringMap({
    components: detectExportPattern(input.exports, (entry) =>
      isComponentFile(entry.file) && (entry.type === 'function' || entry.type === 'class')
    ),
    functions: detectExportPattern(input.exports, (entry) => entry.type === 'function'),
    constants: detectExportPattern(input.exports, (entry) =>
      entry.type === 'variable' || entry.type === 'enum'
    ),
  });

  const conventions: Conventions = {
    version: SUPPORTED_VERSIONS.context,
    source: 'auto',
    detectedAt: new Date().toISOString(),
    naming: {},
  };

  if (namingFiles) {
    conventions.naming.files = namingFiles;
  }

  if (exportConventions) {
    conventions.naming.exports = exportConventions;
  }

  const importConventions = classifyImportStyle(input.imports);
  if (importConventions) {
    conventions.imports = importConventions;
  }

  return conventions;
}
