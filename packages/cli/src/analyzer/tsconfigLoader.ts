import * as fs from 'fs';
import * as path from 'path';
import { parseJsonWithComments } from '../utils/jsonc.js';

export interface TsConfigData {
  extends?: string;
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[] | string>;
  };
}

export interface AliasEntry {
  pattern: string;
  prefix: string;
  suffix: string;
  hasStar: boolean;
  targets: string[];
  order: number;
}

export function findNearestTsConfig(
  filePath: string,
  projectRoot: string,
  cache: Map<string, string | null>
): string | null {
  const rootLimit = path.resolve(projectRoot);
  const visited: string[] = [];
  let currentDir = path.dirname(filePath);

  while (true) {
    const normalized = path.resolve(currentDir);
    const cached = cache.get(normalized);
    if (cached !== undefined) {
      for (const dir of visited) {
        cache.set(dir, cached);
      }
      return cached;
    }

    const candidate = path.join(normalized, 'tsconfig.json');
    if (fs.existsSync(candidate)) {
      for (const dir of visited) {
        cache.set(dir, candidate);
      }
      cache.set(normalized, candidate);
      return candidate;
    }

    visited.push(normalized);

    if (normalized === rootLimit) {
      for (const dir of visited) {
        cache.set(dir, null);
      }
      return null;
    }

    const parent = path.dirname(normalized);
    if (parent === normalized) {
      for (const dir of visited) {
        cache.set(dir, null);
      }
      return null;
    }

    currentDir = parent;
  }
}

export function loadAliasEntries(
  configPath: string,
  cache: Map<string, AliasEntry[] | null>,
  invalidConfigs: Set<string>,
  stack: Set<string> = new Set()
): AliasEntry[] {
  const cached = cache.get(configPath);
  if (cached !== undefined) {
    return cached ?? [];
  }

  if (stack.has(configPath)) {
    return [];
  }

  stack.add(configPath);
  const config = readTsConfig(configPath, invalidConfigs);
  if (!config) {
    cache.set(configPath, null);
    return [];
  }

  const baseEntries = resolveExtends(config, configPath, cache, invalidConfigs, stack);
  const ownEntries = buildAliasEntries(config, configPath);
  const merged = mergeAliasEntries(baseEntries, ownEntries);

  cache.set(configPath, merged);
  return merged;
}

function resolveExtends(
  config: TsConfigData,
  configPath: string,
  cache: Map<string, AliasEntry[] | null>,
  invalidConfigs: Set<string>,
  stack: Set<string>
): AliasEntry[] {
  if (!config.extends) {
    return [];
  }

  const resolved = resolveExtendsPath(config.extends, path.dirname(configPath));
  if (!resolved) {
    return [];
  }

  return loadAliasEntries(resolved, cache, invalidConfigs, stack);
}

function resolveExtendsPath(value: string, fromDir: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withJson = ensureJsonExtension(path.resolve(fromDir, trimmed));
  if (fs.existsSync(withJson)) {
    return withJson;
  }

  if (path.isAbsolute(trimmed)) {
    const absoluteWithJson = ensureJsonExtension(trimmed);
    return fs.existsSync(absoluteWithJson) ? absoluteWithJson : null;
  }

  return null;
}

function ensureJsonExtension(filePath: string): string {
  return filePath.endsWith('.json') ? filePath : `${filePath}.json`;
}

function readTsConfig(configPath: string, invalidConfigs: Set<string>): TsConfigData | null {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = parseJsonWithComments(content) as TsConfigData | null;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid tsconfig format');
    }
    return parsed;
  } catch {
    if (!invalidConfigs.has(configPath)) {
      console.warn(`WARN Invalid tsconfig.json at ${configPath}`);
      invalidConfigs.add(configPath);
    }
    return null;
  }
}

function buildAliasEntries(config: TsConfigData, configPath: string): AliasEntry[] {
  const compilerOptions = config.compilerOptions ?? {};
  const paths = compilerOptions.paths;
  if (!paths) {
    return [];
  }

  const baseUrl = compilerOptions.baseUrl ?? '.';
  const baseDir = path.dirname(configPath);
  const baseRoot = path.resolve(baseDir, baseUrl);

  const entries: AliasEntry[] = [];
  let order = 0;

  for (const [pattern, targets] of Object.entries(paths)) {
    const normalizedTargets = Array.isArray(targets) ? targets : [targets];
    const resolvedTargets = normalizedTargets
      .filter((target) => typeof target === 'string')
      .map((target) => path.resolve(baseRoot, target));

    if (resolvedTargets.length === 0) {
      continue;
    }

    const { prefix, suffix, hasStar } = splitPattern(pattern);
    entries.push({
      pattern,
      prefix,
      suffix,
      hasStar,
      targets: resolvedTargets,
      order,
    });
    order += 1;
  }

  return entries;
}

function mergeAliasEntries(baseEntries: AliasEntry[], overrideEntries: AliasEntry[]): AliasEntry[] {
  if (overrideEntries.length === 0) {
    return baseEntries;
  }

  const merged: AliasEntry[] = [];
  const seen = new Set<string>();

  for (const entry of overrideEntries) {
    merged.push(entry);
    seen.add(entry.pattern);
  }

  for (const entry of baseEntries) {
    if (!seen.has(entry.pattern)) {
      merged.push(entry);
    }
  }

  return merged;
}

function splitPattern(pattern: string): { prefix: string; suffix: string; hasStar: boolean } {
  const index = pattern.indexOf('*');
  if (index === -1) {
    return { prefix: pattern, suffix: '', hasStar: false };
  }
  return {
    prefix: pattern.slice(0, index),
    suffix: pattern.slice(index + 1),
    hasStar: true,
  };
}
