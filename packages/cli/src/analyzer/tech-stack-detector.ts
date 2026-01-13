import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import type { TechStack } from '../types/context.js';
import {
  detectLanguagesAndPatterns,
  detectStructure,
  mergeDependencies,
  readPackageJson,
} from './techStackHelpers.js';

export interface TechStackDetectionInput {
  rootDir: string;
  packageJsonPaths: string[];
}

const FRAMEWORK_CATEGORIES = {
  frontend: ['react', 'vue', 'svelte', 'angular', 'solid-js', 'preact'],
  backend: ['express', 'fastify', 'koa', 'nest', 'hapi'],
  fullstack: ['next', 'nuxt', 'remix', 'sveltekit'],
  mobile: ['react-native', 'expo'],
  desktop: ['electron', 'tauri'],
  ai: ['@modelcontextprotocol/sdk', 'openai', 'anthropic', '@langchain/*'],
};

const BUILD_TOOLS = [
  'vite',
  'webpack',
  'rollup',
  'esbuild',
  'tsup',
  'parcel',
  'turbo',
  'typescript',
];

const TESTING_TOOLS = [
  'jest',
  'vitest',
  'mocha',
  'cypress',
  'playwright',
  '@testing-library/*',
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

function buildFrameworks(deps: Map<string, string>): TechStack['frameworks'] {
  const names = Array.from(deps.keys());
  const frameworks: TechStack['frameworks'] = [];
  const usageByCategory: Record<keyof typeof FRAMEWORK_CATEGORIES, string> = {
    frontend: 'frontend UI',
    backend: 'backend API',
    fullstack: 'fullstack',
    mobile: 'mobile app',
    desktop: 'desktop app',
    ai: 'ai/mcp',
  };

  for (const category of Object.keys(FRAMEWORK_CATEGORIES) as Array<
    keyof typeof FRAMEWORK_CATEGORIES
  >) {
    const matches = collectMatches(names, FRAMEWORK_CATEGORIES[category]);

    for (const match of matches) {
      frameworks.push({
        name: match,
        version: deps.get(match),
        usage: usageByCategory[category],
      });
    }
  }

  frameworks.sort((a, b) => a.name.localeCompare(b.name));
  return frameworks;
}

function buildDependencies(deps: Map<string, string>): TechStack['dependencies'] {
  const entries = Array.from(deps.entries()).map(([name, version]) => ({
    name,
    version,
  }));

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

function detectBuildTools(deps: Map<string, string>): string[] {
  const names = Array.from(deps.keys());
  return collectMatches(names, BUILD_TOOLS);
}

function detectTestingTools(deps: Map<string, string>): string[] {
  const names = Array.from(deps.keys());
  return collectMatches(names, TESTING_TOOLS);
}

export function detectTechStack(input: TechStackDetectionInput): TechStack {
  const packageJsons = input.packageJsonPaths.map((pkgPath) => readPackageJson(pkgPath));
  const dependencies = mergeDependencies(packageJsons);

  const frameworks = buildFrameworks(dependencies);
  const dependencyList = buildDependencies(dependencies);
  const buildTools = detectBuildTools(dependencies);
  const testingFrameworks = detectTestingTools(dependencies);
  const { languages, testPatterns } = detectLanguagesAndPatterns(input.rootDir);
  const structure = detectStructure(input.rootDir, input.packageJsonPaths);

  const techStack: TechStack = {
    version: SUPPORTED_VERSIONS.context,
    source: 'auto',
    detectedAt: new Date().toISOString(),
    frameworks,
    dependencies: dependencyList,
    buildTools,
    languages,
    structure,
  };

  if (testingFrameworks.length > 0 || testPatterns.length > 0) {
    techStack.testing = {
      frameworks: testingFrameworks,
      patterns: testPatterns,
    };
  }

  return techStack;
}
