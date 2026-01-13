import * as path from 'path';
import fg from 'fast-glob';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import type { Testing } from '../types/context.js';
import { mergeDependencies, readPackageJson } from './techStackHelpers.js';

export interface TestingDetectionInput {
  projectRoot: string;
  packageJsonPaths: string[];
}

const TEST_FRAMEWORKS = [
  'jest',
  'vitest',
  'mocha',
  'ava',
  'tap',
  'uvu',
  '@testing-library/*',
  '@playwright/test',
  'playwright',
  'cypress',
];

const COVERAGE_TOOLS = [
  'nyc',
  'istanbul',
  'c8',
  '@vitest/coverage-*',
];

const TEST_FILE_PATTERNS = ['**/*.test.*', '**/*.spec.*'];

const TEST_SCAN_IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.featuremap/**',
  '**/.git/**',
];

const COVERAGE_SCAN_IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.featuremap/**',
  '**/.git/**',
];

const COVERAGE_REPORT_PATTERNS = [
  '**/coverage/lcov.info',
  '**/coverage/coverage-final.json',
  '**/coverage/coverage-summary.json',
  '**/coverage/cobertura-coverage.xml',
  '**/coverage/coverage.xml',
  '**/.nyc_output/out.json',
];

function matchPattern(name: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return name === pattern;
  }

  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return name.startsWith(prefix);
  }

  return false;
}

function collectMatches(names: string[], patterns: string[]): string[] {
  const matches = new Set<string>();

  for (const pattern of patterns) {
    for (const name of names) {
      if (matchPattern(name, pattern)) {
        matches.add(name);
      }
    }
  }

  return Array.from(matches).sort((a, b) => a.localeCompare(b));
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function buildFrameworks(dependencies: Map<string, string>): Testing['frameworks'] {
  const names = Array.from(dependencies.keys());
  const matches = collectMatches(names, TEST_FRAMEWORKS);

  return matches.map((name) => ({
    name,
    version: dependencies.get(name),
  }));
}

function detectCoverageTools(dependencies: Map<string, string>): string[] {
  const names = Array.from(dependencies.keys());
  return collectMatches(names, COVERAGE_TOOLS);
}

function detectTestFiles(projectRoot: string): { total: number; patterns: string[] } {
  const files = fg.sync(TEST_FILE_PATTERNS, {
    cwd: projectRoot,
    absolute: true,
    onlyFiles: true,
    ignore: TEST_SCAN_IGNORES,
  });

  const patternSet = new Set<string>();

  for (const filePath of files) {
    const baseName = path.basename(filePath);
    if (baseName.includes('.test.')) {
      patternSet.add('*.test.*');
    }
    if (baseName.includes('.spec.')) {
      patternSet.add('*.spec.*');
    }
  }

  return {
    total: files.length,
    patterns: Array.from(patternSet).sort((a, b) => a.localeCompare(b)),
  };
}

function detectCoverageReports(projectRoot: string): string[] {
  const reports = fg.sync(COVERAGE_REPORT_PATTERNS, {
    cwd: projectRoot,
    absolute: true,
    onlyFiles: true,
    dot: true,
    ignore: COVERAGE_SCAN_IGNORES,
  });

  const normalized = reports.map((report) =>
    normalizePath(path.relative(projectRoot, report))
  );

  normalized.sort((a, b) => a.localeCompare(b));
  return normalized;
}

export function detectTesting(input: TestingDetectionInput): Testing {
  const packageJsons = input.packageJsonPaths.map((pkgPath) => readPackageJson(pkgPath));
  const dependencies = mergeDependencies(packageJsons);
  const frameworks = buildFrameworks(dependencies);
  const testFiles = detectTestFiles(input.projectRoot);
  const coverageReports = detectCoverageReports(input.projectRoot);
  const coverageTools = detectCoverageTools(dependencies);

  const coverage =
    coverageReports.length > 0 || coverageTools.length > 0
      ? {
          reports: coverageReports,
          tools: coverageTools,
        }
      : undefined;

  return {
    version: SUPPORTED_VERSIONS.context,
    source: 'auto',
    detectedAt: new Date().toISOString(),
    frameworks,
    testFiles,
    coverage,
  };
}
