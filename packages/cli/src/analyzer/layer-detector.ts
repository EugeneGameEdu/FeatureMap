export type Layer = 'frontend' | 'backend' | 'shared' | 'infrastructure';
export type Confidence = 'high' | 'medium' | 'low';

export interface LayerDetectionResult {
  layer: Layer;
  confidence: Confidence;
  signals: string[];
}

export interface LayerDetectionInput {
  files: string[];
  imports: {
    internal: string[];
    external: string[];
  };
  exports: Array<{ name: string; type: string }>;
}

const FRONTEND_IMPORTS = [
  'react',
  'react-dom',
  'vue',
  'svelte',
  'solid-js',
  '@xyflow/react',
  'tailwindcss',
  'styled-components',
];
const FRONTEND_IMPORT_PREFIXES = ['@angular/', '@emotion/'];

const BACKEND_IMPORTS = [
  'express',
  'fastify',
  'koa',
  'hapi',
  'nest',
  'pg',
  'mysql',
  'mongodb',
  'prisma',
  'drizzle',
  'sequelize',
  '@modelcontextprotocol/sdk',
];
const BACKEND_IMPORT_PREFIXES = ['@modelcontextprotocol/', '@nestjs/'];

const INFRA_IMPORTS = ['vite', 'webpack', 'rollup', 'esbuild', 'tsup'];

const FRONTEND_PATHS = ['/web/', '/ui/', '/components/', '/pages/', '/views/', '/frontend/'];
const BACKEND_PATHS = [
  '/api/',
  '/server/',
  '/backend/',
  '/routes/',
  '/controllers/',
  '/mcp-server/',
];
const SHARED_PATHS = ['/shared/', '/common/', '/utils/', '/types/', '/lib/'];
const INFRA_PATHS = ['/scripts/', '/config/', '/build/', '/.github/', '/ci/'];

const FRONTEND_EXTENSIONS = ['.tsx', '.jsx', '.vue', '.svelte'];

const INFRA_FILE_PREFIXES = ['vite.config', 'tsconfig', 'webpack', 'rollup', '.eslintrc'];

const LAYERS: Layer[] = ['frontend', 'backend', 'shared', 'infrastructure'];

const REACT_COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;
const ROUTE_EXPORT_MATCHERS = [
  'handler',
  'middleware',
  'router',
  'controller',
  'route',
];

export function detectLayer(input: LayerDetectionInput): LayerDetectionResult {
  const normalizedFiles = input.files.map((file) => normalizePath(file));
  const fileExtensions = new Set(normalizedFiles.map((file) => getExtension(file)));
  const fileNames = normalizedFiles.map((file) => getBaseName(file));

  const externalImports = normalizeExternalImports(input.imports.external);
  const internalImports = input.imports.internal.map((value) => normalizeImportPath(value));

  const signalsByLayer: Record<Layer, string[]> = {
    frontend: [],
    backend: [],
    shared: [],
    infrastructure: [],
  };
  const signalSets: Record<Layer, Set<string>> = {
    frontend: new Set(),
    backend: new Set(),
    shared: new Set(),
    infrastructure: new Set(),
  };
  const allSignals: string[] = [];
  const allSignalSet = new Set<string>();

  const addSignal = (layer: Layer, message: string): void => {
    if (!signalSets[layer].has(message)) {
      signalSets[layer].add(message);
      signalsByLayer[layer].push(message);
    }
    if (!allSignalSet.has(message)) {
      allSignalSet.add(message);
      allSignals.push(message);
    }
  };

  addPathSignals(normalizedFiles, FRONTEND_PATHS, 'frontend', addSignal);
  addPathSignals(normalizedFiles, BACKEND_PATHS, 'backend', addSignal);
  addPathSignals(normalizedFiles, SHARED_PATHS, 'shared', addSignal);
  addPathSignals(normalizedFiles, INFRA_PATHS, 'infrastructure', addSignal);

  for (const extension of FRONTEND_EXTENSIONS) {
    if (fileExtensions.has(extension)) {
      addSignal('frontend', `file extension ${extension}`);
    }
  }

  for (const prefix of INFRA_FILE_PREFIXES) {
    if (fileNames.some((name) => name.startsWith(prefix))) {
      addSignal('infrastructure', `file name starts with ${prefix}`);
    }
  }

  for (const importName of externalImports) {
    if (matchesImport(importName, FRONTEND_IMPORTS, FRONTEND_IMPORT_PREFIXES)) {
      addSignal('frontend', `imports ${importName}`);
    }
    if (matchesImport(importName, BACKEND_IMPORTS, BACKEND_IMPORT_PREFIXES)) {
      addSignal('backend', `imports ${importName}`);
    }
    if (matchesImport(importName, INFRA_IMPORTS, [])) {
      addSignal('infrastructure', `imports ${importName}`);
    }
  }

  const hasFrontendImport = externalImports.some((importName) =>
    matchesImport(importName, FRONTEND_IMPORTS, FRONTEND_IMPORT_PREFIXES)
  );
  const hasJsxFile = FRONTEND_EXTENSIONS.some((extension) => fileExtensions.has(extension));
  const hasReactComponentExport = input.exports.some((entry) => {
    if (!REACT_COMPONENT_NAME.test(entry.name)) {
      return false;
    }
    return !['type', 'interface'].includes(entry.type);
  });

  if (hasReactComponentExport && (hasJsxFile || hasFrontendImport)) {
    addSignal('frontend', 'exports React components');
  }

  const hasRouteExports = input.exports.some((entry) => {
    if (!['function', 'variable', 'class'].includes(entry.type)) {
      return false;
    }
    const name = entry.name.toLowerCase();
    return ROUTE_EXPORT_MATCHERS.some((matcher) => name.includes(matcher));
  });

  if (hasRouteExports) {
    addSignal('backend', 'exports route handlers');
  }

  if (hasTypeOnlyExports(input.exports)) {
    addSignal('shared', 'exports only types');
  }

  const internalFrontendHit = internalImports.some((value) =>
    matchesPathPatterns(value, FRONTEND_PATHS)
  );
  const internalBackendHit = internalImports.some((value) =>
    matchesPathPatterns(value, BACKEND_PATHS)
  );
  if (internalFrontendHit && internalBackendHit) {
    addSignal('shared', 'internal imports reference frontend and backend');
  }

  const layerCounts = LAYERS.map((layer) => ({
    layer,
    count: signalsByLayer[layer].length,
  })).sort((left, right) => right.count - left.count);

  const top = layerCounts[0];
  const second = layerCounts[1];

  if (!top || top.count === 0) {
    return {
      layer: 'shared',
      confidence: 'low',
      signals: allSignals,
    };
  }

  if (second && second.count > 0) {
    if (second.count === top.count) {
      return {
        layer: 'shared',
        confidence: 'low',
        signals: allSignals,
      };
    }

    return {
      layer: top.layer,
      confidence: 'medium',
      signals: allSignals,
    };
  }

  return {
    layer: top.layer,
    confidence: calculateConfidence(signalsByLayer[top.layer]),
    signals: allSignals,
  };
}

function calculateConfidence(signals: string[]): Confidence {
  if (signals.length >= 3) {
    return 'high';
  }
  if (signals.length >= 1) {
    return 'medium';
  }
  return 'low';
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase();
}

function normalizeImportPath(value: string): string {
  const normalized = normalizePath(value);
  return `/${normalized.replace(/^\/+/, '')}/`;
}

function normalizeExternalImports(imports: string[]): string[] {
  const roots = new Set<string>();
  const sorted = [...imports].sort((a, b) => a.localeCompare(b));

  for (const entry of sorted) {
    const root = getPackageRoot(entry).toLowerCase();
    if (root) {
      roots.add(root);
    }
  }

  return [...roots];
}

function getPackageRoot(moduleName: string): string {
  const trimmed = moduleName.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('@')) {
    const segments = trimmed.split('/');
    if (segments.length >= 2) {
      return `${segments[0]}/${segments[1]}`;
    }
    return trimmed;
  }

  return trimmed.split('/')[0];
}

function getExtension(filePath: string): string {
  const index = filePath.lastIndexOf('.');
  if (index === -1) {
    return '';
  }
  return filePath.slice(index);
}

function getBaseName(filePath: string): string {
  const index = filePath.lastIndexOf('/');
  if (index === -1) {
    return filePath;
  }
  return filePath.slice(index + 1);
}

function addPathSignals(
  files: string[],
  patterns: string[],
  layer: Layer,
  addSignal: (layer: Layer, message: string) => void
): void {
  const normalizedFiles = files.map((file) => `/${file.replace(/^\/+/, '')}/`);

  for (const pattern of patterns) {
    if (normalizedFiles.some((file) => file.includes(pattern))) {
      addSignal(layer, `path contains ${pattern}`);
    }
  }
}

function matchesImport(
  value: string,
  exact: string[],
  prefixes: string[]
): boolean {
  if (exact.includes(value)) {
    return true;
  }
  return prefixes.some((prefix) => value.startsWith(prefix));
}

function matchesPathPatterns(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

function hasTypeOnlyExports(exportsList: Array<{ name: string; type: string }>): boolean {
  if (exportsList.length === 0) {
    return false;
  }
  return exportsList.every((entry) => ['type', 'interface'].includes(entry.type));
}
