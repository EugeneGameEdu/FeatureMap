import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import type { Structure } from '../types/context.js';
import {
  detectStructure,
  readPackageJson,
  type PackageJsonData,
} from './techStackHelpers.js';

export interface StructureDetectionInput {
  projectRoot: string;
  packageJsonPaths: string[];
  goModPaths: string[];
}

const PACKAGE_MANAGER_FILES: Array<{ name: Structure['workspace']['packageManager']; files: string[] }> =
  [
    { name: 'pnpm', files: ['pnpm-lock.yaml'] },
    { name: 'yarn', files: ['yarn.lock'] },
    { name: 'npm', files: ['package-lock.json', 'npm-shrinkwrap.json'] },
    { name: 'bun', files: ['bun.lockb'] },
  ];

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function parsePackageManagerSpec(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('@')) {
    const lastAt = trimmed.lastIndexOf('@');
    if (lastAt > 0) {
      return trimmed.slice(0, lastAt);
    }
  }

  const name = trimmed.split('@')[0];
  return name || null;
}

function normalizePackageManagerName(
  value: string | null
): Structure['workspace']['packageManager'] {
  if (!value) {
    return 'unknown';
  }

  const lowered = value.toLowerCase();
  if (lowered.includes('pnpm')) {
    return 'pnpm';
  }
  if (lowered.includes('yarn')) {
    return 'yarn';
  }
  if (lowered.includes('npm')) {
    return 'npm';
  }
  if (lowered.includes('bun')) {
    return 'bun';
  }

  return 'unknown';
}

function detectPackageManager(
  projectRoot: string,
  rootPackage: PackageJsonData | null
): Structure['workspace']['packageManager'] {
  const packageManagerSpec = getPackageManagerSpec(rootPackage);
  if (packageManagerSpec) {
    const parsed = parsePackageManagerSpec(packageManagerSpec);
    const normalized = normalizePackageManagerName(parsed);
    if (normalized !== 'unknown') {
      return normalized;
    }
  }

  for (const entry of PACKAGE_MANAGER_FILES) {
    for (const file of entry.files) {
      if (fs.existsSync(path.join(projectRoot, file))) {
        return entry.name;
      }
    }
  }

  return 'unknown';
}

function getPackageManagerSpec(rootPackage: PackageJsonData | null): string | null {
  if (!rootPackage) {
    return null;
  }

  const candidate = (rootPackage as PackageJsonData & { packageManager?: string }).packageManager;
  return typeof candidate === 'string' ? candidate : null;
}

function readWorkspaceGlobs(
  projectRoot: string,
  rootPackage: PackageJsonData | null
): string[] {
  if (rootPackage) {
    const workspaces = rootPackage.workspaces;
    if (Array.isArray(workspaces)) {
      return workspaces.slice();
    }
    if (workspaces && Array.isArray(workspaces.packages)) {
      return workspaces.packages.slice();
    }
  }

  const pnpmGlobs = readPnpmWorkspaceGlobs(projectRoot);
  if (pnpmGlobs.length > 0) {
    return pnpmGlobs;
  }

  const lernaGlobs = readLernaGlobs(projectRoot);
  if (lernaGlobs.length > 0) {
    return lernaGlobs;
  }

  return [];
}

function readPnpmWorkspaceGlobs(projectRoot: string): string[] {
  const workspacePath = path.join(projectRoot, 'pnpm-workspace.yaml');
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

function readLernaGlobs(projectRoot: string): string[] {
  const lernaPath = path.join(projectRoot, 'lerna.json');
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

function normalizePaths(paths: string[], projectRoot: string): string[] {
  const normalized = paths.map((entry) =>
    normalizePath(path.relative(projectRoot, entry))
  );

  normalized.sort((a, b) => a.localeCompare(b));
  return normalized;
}

export function detectStructureContext(input: StructureDetectionInput): Structure {
  const rootPackagePath = path.join(input.projectRoot, 'package.json');
  const rootPackage = readPackageJson(rootPackagePath);
  const workspaceGlobs = readWorkspaceGlobs(input.projectRoot, rootPackage).sort((a, b) =>
    a.localeCompare(b)
  );
  const structure = detectStructure(input.projectRoot, input.packageJsonPaths);
  const packageManager = detectPackageManager(input.projectRoot, rootPackage);

  const workspace: Structure['workspace'] = {
    type: structure.type,
    packageManager,
  };

  if (structure.packages && structure.packages.length > 0) {
    workspace.packages = [...structure.packages].sort((a, b) => a.localeCompare(b));
  }

  if (workspaceGlobs.length > 0) {
    workspace.workspaceGlobs = workspaceGlobs;
  }

  return {
    version: SUPPORTED_VERSIONS.context,
    source: 'auto',
    detectedAt: new Date().toISOString(),
    workspace,
    subprojects: {
      packageJson: normalizePaths(input.packageJsonPaths, input.projectRoot),
      goModules: normalizePaths(input.goModPaths, input.projectRoot),
    },
  };
}
