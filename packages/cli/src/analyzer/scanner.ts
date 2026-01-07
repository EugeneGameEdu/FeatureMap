import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { Config, ConfigSchema } from '../types/config.js';
import { loadYAML } from '../utils/yaml-loader.js';
import { parseGoFile, type ParsedGoFile } from './go-parser.js';
import { readGoMod, type GoModule } from './go-module.js';

export interface DetectedSubproject {
  type: 'typescript' | 'go';
  root: string;
  name: string;
  goModPath?: string;
}

export interface ParsedGoFileWithModule extends ParsedGoFile {
  moduleRoot: string;
  modulePath: string;
}

export interface ScanResult {
  config: Config;
  files: string[];
  goFiles?: ParsedGoFileWithModule[];
  goModules?: GoModule[];
  subprojects?: DetectedSubproject[];
  projectRoot: string;
}

const SUBPROJECT_DETECT_IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.featuremap/**',
];

const DEFAULT_TS_IGNORE = [
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/*.d.ts',
  '**/*.config.js',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
];

const GO_PATTERNS = [
  '**/cmd/**/*.go',
  '**/internal/**/*.go',
  '**/pkg/**/*.go',
  '**/*.go',
];

const GO_IGNORE = [
  '**/vendor/**',
  '**/*_test.go',
  '**/testdata/**',
];

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

  const configFiles = await fg(config.scan.include, {
    cwd: scanRoot,
    ignore: config.scan.exclude,
    absolute: true,
    onlyFiles: true,
    dot: false,
  });

  const filesSet = new Set<string>(configFiles);

  const subprojects = await detectSubprojects(scanRoot);
  const tsSubprojects = subprojects.filter((entry) => entry.type === 'typescript');
  const goSubprojects = subprojects.filter((entry) => entry.type === 'go');

  if (tsSubprojects.length > 0) {
    const tsIgnore = mergeIgnorePatterns(config.scan.exclude, DEFAULT_TS_IGNORE);
    for (const subproject of tsSubprojects) {
      const patterns = getTypescriptPatterns(subproject.root);
      const tsFiles = await fg(patterns, {
        cwd: subproject.root,
        ignore: tsIgnore,
        absolute: true,
        onlyFiles: true,
        dot: false,
      });
      for (const file of tsFiles) {
        filesSet.add(file);
      }
    }
  }

  const files = [...filesSet].sort((a, b) => a.localeCompare(b));
  const { goFiles, goModules } = await scanGoSubprojects(goSubprojects, scanRoot);

  return {
    config,
    files,
    goFiles: goFiles.length > 0 ? goFiles : undefined,
    goModules: goModules.length > 0 ? goModules : undefined,
    subprojects: subprojects.length > 0 ? subprojects : undefined,
    projectRoot: scanRoot,
  };
}

async function scanGoSubprojects(
  subprojects: DetectedSubproject[],
  scanRoot: string
): Promise<{ goFiles: ParsedGoFileWithModule[]; goModules: GoModule[] }> {
  const parsedGoFiles: ParsedGoFileWithModule[] = [];
  const goModules: GoModule[] = [];
  const seenGoRoots = new Set<string>();

  for (const subproject of subprojects) {
    if (!subproject.goModPath || seenGoRoots.has(subproject.root)) {
      continue;
    }
    seenGoRoots.add(subproject.root);

    const goModule = readGoMod(subproject.goModPath);
    if (!goModule) {
      continue;
    }

    goModules.push(goModule);

    const goFilePaths = await fg(GO_PATTERNS, {
      cwd: goModule.moduleRoot,
      ignore: GO_IGNORE,
      absolute: true,
      onlyFiles: true,
      dot: false,
    });

    const moduleRootRelative = normalizePath(getRelativePath(goModule.moduleRoot, scanRoot) || '.');

    for (const absolutePath of goFilePaths) {
      const parsed = parseGoFile(absolutePath, goModule.modulePath);
      if (!parsed) {
        continue;
      }
      parsedGoFiles.push({
        ...parsed,
        path: getRelativePath(parsed.path, scanRoot),
        moduleRoot: moduleRootRelative,
        modulePath: goModule.modulePath,
      });
    }
  }

  parsedGoFiles.sort((a, b) => a.path.localeCompare(b.path));

  return {
    goFiles: parsedGoFiles,
    goModules,
  };
}

export function getRelativePath(absolutePath: string, projectRoot: string): string {
  return path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
}

export async function detectSubprojects(projectRoot: string): Promise<DetectedSubproject[]> {
  const subprojects: DetectedSubproject[] = [];
  const seen = new Set<string>();

  const packageJsons = await fg('**/package.json', {
    cwd: projectRoot,
    ignore: SUBPROJECT_DETECT_IGNORE,
    absolute: true,
    onlyFiles: true,
    dot: false,
  });

  for (const packageJson of packageJsons) {
    const root = path.dirname(packageJson);
    const name = path.basename(root);
    addSubproject(subprojects, seen, {
      type: 'typescript',
      root,
      name,
    });
  }

  const goMods = await fg('**/go.mod', {
    cwd: projectRoot,
    ignore: [...SUBPROJECT_DETECT_IGNORE, '**/vendor/**'],
    absolute: true,
    onlyFiles: true,
    dot: false,
  });

  for (const goModPath of goMods) {
    const root = path.dirname(goModPath);
    const name = path.basename(root);
    addSubproject(subprojects, seen, {
      type: 'go',
      root,
      name,
      goModPath,
    });
  }

  subprojects.sort((a, b) => a.root.localeCompare(b.root));
  return subprojects;
}

function addSubproject(
  subprojects: DetectedSubproject[],
  seen: Set<string>,
  entry: DetectedSubproject
): void {
  const key = `${entry.type}:${entry.root}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  subprojects.push(entry);
}

function getTypescriptPatterns(rootDir: string): string[] {
  const srcPath = path.join(rootDir, 'src');
  if (fs.existsSync(srcPath)) {
    return ['src/**/*.{ts,tsx,js,jsx}'];
  }
  return ['**/*.{ts,tsx,js,jsx}'];
}

function mergeIgnorePatterns(base: string[], extra: string[]): string[] {
  const merged = new Set<string>([...base, ...extra]);
  return [...merged];
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}
