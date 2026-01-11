import * as path from 'path';
import {
  findNearestTsConfig,
  loadAliasEntries,
  type AliasEntry,
} from './tsconfigLoader.js';

export interface AliasResolver {
  isAliasImport(moduleSpecifier: string, filePath: string): boolean;
  resolveAliasImport(moduleSpecifier: string, filePath: string): string | null;
}

const KNOWN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const RESOLVE_EXTENSIONS = [...KNOWN_EXTENSIONS, ''];

export function createAliasResolver(options: {
  projectRoot: string;
  filePaths: string[];
}): AliasResolver {
  const projectRoot = path.resolve(options.projectRoot);
  const fileSet = new Set(options.filePaths.map(normalizePath));
  const configByDir = new Map<string, string | null>();
  const aliasCache = new Map<string, AliasEntry[] | null>();
  const invalidConfigs = new Set<string>();

  const getAliasEntries = (filePath: string): AliasEntry[] => {
    const configPath = findNearestTsConfig(filePath, projectRoot, configByDir);
    if (!configPath) {
      return [];
    }
    return loadAliasEntries(configPath, aliasCache, invalidConfigs);
  };

  const isAliasImport = (moduleSpecifier: string, filePath: string): boolean => {
    if (!moduleSpecifier || moduleSpecifier.startsWith('.')) {
      return false;
    }
    const entries = getAliasEntries(filePath);
    return entries.some((entry) => matchAlias(entry, moduleSpecifier) !== null);
  };

  const resolveAliasImport = (moduleSpecifier: string, filePath: string): string | null => {
    if (!moduleSpecifier || moduleSpecifier.startsWith('.')) {
      return null;
    }

    const entries = getAliasEntries(filePath);
    const matches = entries
      .map((entry) => ({ entry, match: matchAlias(entry, moduleSpecifier) }))
      .filter((result) => result.match !== null)
      .sort((left, right) => {
        const leftScore = left.entry.prefix.length + left.entry.suffix.length;
        const rightScore = right.entry.prefix.length + right.entry.suffix.length;
        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }
        return left.entry.order - right.entry.order;
      });

    for (const { entry, match } of matches) {
      for (const target of entry.targets) {
        const candidate = applyAliasTarget(target, match ?? '');
        const resolved = resolveExistingFile(candidate, projectRoot, fileSet);
        if (resolved) {
          return resolved;
        }
      }
    }

    return null;
  };

  return {
    isAliasImport,
    resolveAliasImport,
  };
}

function matchAlias(entry: AliasEntry, moduleSpecifier: string): string | null {
  if (!entry.hasStar) {
    return moduleSpecifier === entry.pattern ? '' : null;
  }

  if (!moduleSpecifier.startsWith(entry.prefix)) {
    return null;
  }
  if (!moduleSpecifier.endsWith(entry.suffix)) {
    return null;
  }

  return moduleSpecifier.slice(
    entry.prefix.length,
    moduleSpecifier.length - entry.suffix.length
  );
}

function applyAliasTarget(target: string, match: string): string {
  if (!target.includes('*')) {
    return target;
  }
  return target.replace(/\*/g, match);
}

function resolveExistingFile(
  candidatePath: string,
  projectRoot: string,
  fileSet: Set<string>
): string | null {
  const normalizedBase = path.resolve(candidatePath);
  const baseExt = path.extname(normalizedBase);
  const hasKnownExt = KNOWN_EXTENSIONS.includes(baseExt);
  const baseCandidates = hasKnownExt
    ? [normalizedBase]
    : [normalizedBase, path.join(normalizedBase, 'index')];
  const extensions = hasKnownExt ? [''] : RESOLVE_EXTENSIONS;

  for (const base of baseCandidates) {
    for (const ext of extensions) {
      const resolved = toRelativePath(base + ext, projectRoot);
      if (resolved && fileSet.has(resolved)) {
        return resolved;
      }
    }
  }

  if (baseExt === '.js' || baseExt === '.jsx') {
    const withoutExt = normalizedBase.slice(0, -baseExt.length);
    for (const ext of ['.ts', '.tsx']) {
      const resolved = toRelativePath(withoutExt + ext, projectRoot);
      if (resolved && fileSet.has(resolved)) {
        return resolved;
      }
    }
  }

  return null;
}

function toRelativePath(filePath: string, projectRoot: string): string | null {
  const relative = path.relative(projectRoot, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return normalizePath(relative);
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}
