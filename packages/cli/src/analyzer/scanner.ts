import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { Config, ConfigSchema } from '../types/config.js';
import { loadYAML } from '../utils/yaml-loader.js';
import { parseGoFile, type ParsedGoFile } from './go-parser.js';
import { readGoMod, type GoModule } from './go-module.js';

export interface ParsedGoFileWithModule extends ParsedGoFile {
  moduleRoot: string;
  modulePath?: string;
}

export interface ScanResult {
  config: Config;
  files: string[];
  goFiles?: ParsedGoFileWithModule[];
  projectRoot: string;
}

export function loadConfig(configPath: string): Config {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }

  return loadYAML(configPath, ConfigSchema, { fileType: 'config' });
}

export async function scanProject(projectRoot: string): Promise<ScanResult> {
  const configPath = path.join(projectRoot, '.featuremap', 'config.yaml');
  const config = loadConfig(configPath);

  const scanRoot = path.resolve(projectRoot, config.project.root);

  const files = await fg(config.scan.include, {
    cwd: scanRoot,
    ignore: config.scan.exclude,
    absolute: true,
    onlyFiles: true,
    dot: false,
  });

  const tsFiles = files.filter((file) => /\.(ts|tsx|js|jsx)$/i.test(file));
  const goFilePaths = files.filter((file) => /\.go$/i.test(file));
  const parsedGoFiles = await parseGoFiles(goFilePaths, scanRoot, projectRoot);

  tsFiles.sort((a, b) => a.localeCompare(b));
  parsedGoFiles.sort((a, b) => a.path.localeCompare(b.path));

  return {
    config,
    files: tsFiles,
    goFiles: parsedGoFiles.length > 0 ? parsedGoFiles : undefined,
    projectRoot: scanRoot,
  };
}

async function parseGoFiles(
  goFilePaths: string[],
  scanRoot: string,
  projectRoot: string
): Promise<ParsedGoFileWithModule[]> {
  const parsedGoFiles: ParsedGoFileWithModule[] = [];
  const goModCache = new Map<string, string | null>();
  const moduleCache = new Map<string, GoModule | null>();

  for (const absolutePath of goFilePaths) {
    const goModPath = findNearestGoMod(absolutePath, projectRoot, goModCache);
    const goModule = goModPath ? getGoModule(goModPath, moduleCache) : null;

    const parsed = parseGoFile(absolutePath, goModule?.modulePath ?? null);
    if (!parsed) {
      continue;
    }

    const moduleRoot = goModule?.moduleRoot
      ? normalizePath(getRelativePath(goModule.moduleRoot, scanRoot) || '.')
      : '.';

    parsedGoFiles.push({
      ...parsed,
      path: getRelativePath(parsed.path, scanRoot),
      moduleRoot,
      modulePath: goModule?.modulePath,
    });
  }

  return parsedGoFiles;
}

function getGoModule(goModPath: string, moduleCache: Map<string, GoModule | null>): GoModule | null {
  if (moduleCache.has(goModPath)) {
    return moduleCache.get(goModPath) ?? null;
  }

  const module = readGoMod(goModPath);
  moduleCache.set(goModPath, module ?? null);
  return module ?? null;
}

function findNearestGoMod(
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

    const candidate = path.join(normalized, 'go.mod');
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

export function getRelativePath(absolutePath: string, projectRoot: string): string {
  return path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}
