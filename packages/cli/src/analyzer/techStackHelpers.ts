import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import * as yaml from 'yaml';
import type { TechStack } from '../types/context.js';

export interface PackageJsonData {
  name?: string;
  version?: string;
  main?: string;
  module?: string;
  types?: string;
  bin?: string | Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.cs': 'C#',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.kt': 'Kotlin',
  '.swift': 'Swift',
  '.cpp': 'C++',
  '.c': 'C',
};

const SCAN_IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.featuremap/**',
];

const packageJsonCache = new Map<string, PackageJsonData | null>();

export function readPackageJson(filePath: string): PackageJsonData | null {
  if (packageJsonCache.has(filePath)) {
    return packageJsonCache.get(filePath) ?? null;
  }

  if (!fs.existsSync(filePath)) {
    packageJsonCache.set(filePath, null);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content) as PackageJsonData;
    packageJsonCache.set(filePath, parsed);
    return parsed;
  } catch {
    packageJsonCache.set(filePath, null);
    return null;
  }
}

export function mergeDependencies(
  packageJsons: Array<PackageJsonData | null>
): Map<string, string> {
  const dependencies = new Map<string, string>();

  for (const pkg of packageJsons) {
    if (!pkg) {
      continue;
    }

    const entries = [
      pkg.dependencies,
      pkg.devDependencies,
      pkg.peerDependencies,
      pkg.optionalDependencies,
    ];

    for (const depBlock of entries) {
      if (!depBlock) {
        continue;
      }
      for (const [name, version] of Object.entries(depBlock)) {
        if (!dependencies.has(name)) {
          dependencies.set(name, version);
        }
      }
    }
  }

  return dependencies;
}

export function detectStructure(rootDir: string, packageJsonPaths: string[]): TechStack['structure'] {
  const rootPackagePath = path.join(rootDir, 'package.json');
  const rootPackage = readPackageJson(rootPackagePath);
  const workspaceGlobs = readWorkspaceGlobs(rootPackage);
  const pnpmGlobs = readPnpmWorkspaceGlobs(rootDir);
  const lernaGlobs = readLernaGlobs(rootDir);
  const effectiveGlobs =
    workspaceGlobs.length > 0 ? workspaceGlobs : pnpmGlobs.length > 0 ? pnpmGlobs : lernaGlobs;

  const hasPnpmWorkspace = fs.existsSync(path.join(rootDir, 'pnpm-workspace.yaml'));
  const hasLerna = fs.existsSync(path.join(rootDir, 'lerna.json'));
  const hasWorkspaceConfig = effectiveGlobs.length > 0 || hasPnpmWorkspace || hasLerna;

  const packages = getWorkspacePackageNames(rootDir, packageJsonPaths, effectiveGlobs);

  const rootPackageResolved = path.resolve(rootPackagePath);
  const otherPackages = packageJsonPaths.filter(
    (pkgPath) => path.resolve(pkgPath) !== rootPackageResolved
  );

  const entryPoints = detectEntryPoints(rootPackage);

  if (hasWorkspaceConfig || otherPackages.length > 0) {
    const structure: TechStack['structure'] = {
      type: hasWorkspaceConfig ? 'monorepo' : 'multi-root',
      packages:
        packages.length > 0
          ? packages
          : otherPackages.map((pkgPath) => path.basename(path.dirname(pkgPath))),
    };
    if (entryPoints) {
      structure.entryPoints = entryPoints;
    }
    return structure;
  }

  const structure: TechStack['structure'] = { type: 'single-package' };
  if (entryPoints) {
    structure.entryPoints = entryPoints;
  }
  return structure;
}

export function detectLanguagesAndPatterns(rootDir: string): {
  languages: TechStack['languages'];
  testPatterns: string[];
} {
  const extensions = Object.keys(LANGUAGE_EXTENSIONS);
  const patterns = extensions.map((ext) => `**/*${ext}`);

  const files = fg.sync(patterns, {
    cwd: rootDir,
    absolute: true,
    onlyFiles: true,
    ignore: SCAN_IGNORES,
  });

  const counts = new Map<string, number>();
  const testPatternSet = new Set<string>();

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const language = LANGUAGE_EXTENSIONS[ext];
    if (!language) {
      continue;
    }

    counts.set(language, (counts.get(language) ?? 0) + 1);

    const baseName = path.basename(filePath);
    if (baseName.includes('.test.')) {
      testPatternSet.add('*.test.*');
    }
    if (baseName.includes('.spec.')) {
      testPatternSet.add('*.spec.*');
    }
  }

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  const languageEntries = Array.from(counts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : undefined,
    }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)));

  return {
    languages: languageEntries.map(({ name, percentage }) => ({ name, percentage })),
    testPatterns: Array.from(testPatternSet).sort((a, b) => a.localeCompare(b)),
  };
}

function detectEntryPoints(rootPackage: PackageJsonData | null): string[] | undefined {
  if (!rootPackage) {
    return undefined;
  }

  const entries = new Set<string>();

  if (typeof rootPackage.main === 'string') {
    entries.add(rootPackage.main);
  }

  if (typeof rootPackage.module === 'string') {
    entries.add(rootPackage.module);
  }

  if (typeof rootPackage.types === 'string') {
    entries.add(rootPackage.types);
  }

  if (typeof rootPackage.bin === 'string') {
    entries.add(rootPackage.bin);
  } else if (rootPackage.bin && typeof rootPackage.bin === 'object') {
    for (const value of Object.values(rootPackage.bin)) {
      entries.add(value);
    }
  }

  if (entries.size === 0) {
    return undefined;
  }

  return Array.from(entries).sort((a, b) => a.localeCompare(b));
}

function readWorkspaceGlobs(rootPackage: PackageJsonData | null): string[] {
  if (!rootPackage) {
    return [];
  }

  const workspaces = rootPackage.workspaces;
  if (Array.isArray(workspaces)) {
    return workspaces.slice();
  }

  if (workspaces && Array.isArray(workspaces.packages)) {
    return workspaces.packages.slice();
  }

  return [];
}

function readPnpmWorkspaceGlobs(rootDir: string): string[] {
  const workspacePath = path.join(rootDir, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspacePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(workspacePath, 'utf-8');
    const parsed = yaml.parse(content) as { packages?: string[] } | null;
    if (!parsed || !Array.isArray(parsed.packages)) {
      return [];
    }

    return parsed.packages.slice();
  } catch {
    return [];
  }
}

function readLernaGlobs(rootDir: string): string[] {
  const lernaPath = path.join(rootDir, 'lerna.json');
  if (!fs.existsSync(lernaPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(lernaPath, 'utf-8');
    const parsed = JSON.parse(content) as { packages?: string[] } | null;
    if (!parsed || !Array.isArray(parsed.packages)) {
      return [];
    }

    return parsed.packages.slice();
  } catch {
    return [];
  }
}

function getWorkspacePackageNames(
  rootDir: string,
  packageJsonPaths: string[],
  workspaceGlobs: string[]
): string[] {
  if (workspaceGlobs.length === 0) {
    return [];
  }

  const workspacePatterns = workspaceGlobs.map((pattern) =>
    path.posix.join(pattern.replace(/\\/g, '/'), 'package.json')
  );

  const normalizedPaths = packageJsonPaths.map((pkgPath) => path.resolve(rootDir, pkgPath));

  const matches = fg.sync(workspacePatterns, {
    cwd: rootDir,
    absolute: true,
    onlyFiles: true,
    ignore: SCAN_IGNORES,
  });

  const resolvedMatches = new Set(matches.map((pkgPath) => path.resolve(pkgPath)));
  const names = new Set<string>();

  for (const pkgPath of normalizedPaths) {
    if (!resolvedMatches.has(pkgPath)) {
      continue;
    }

    const packageDir = path.dirname(pkgPath);
    names.add(path.basename(packageDir));
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}
