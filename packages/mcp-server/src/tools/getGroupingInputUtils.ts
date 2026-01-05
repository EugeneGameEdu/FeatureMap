import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { normalizeStringList } from '../utils/listUtils.js';

export const DEFAULT_LIMITS = {
  externalImportsTopN: 10,
  keyPathsTopN: 5,
  maxClusters: 200,
};

export type Limits = typeof DEFAULT_LIMITS;

export interface RawCluster {
  id?: string;
  layer?: string;
  layerDetection?: unknown;
  purpose_hint?: string;
  entry_points?: string[];
  imports?: { external?: string[] };
  files?: string[];
  compositionHash?: string;
}

interface GraphData {
  edges?: Array<{ source?: string; target?: string }>;
}

export function applyLimits(limits?: Partial<Limits>): Limits {
  return {
    externalImportsTopN: limits?.externalImportsTopN ?? DEFAULT_LIMITS.externalImportsTopN,
    keyPathsTopN: limits?.keyPathsTopN ?? DEFAULT_LIMITS.keyPathsTopN,
    maxClusters: limits?.maxClusters ?? DEFAULT_LIMITS.maxClusters,
  };
}

export function loadClusters(clustersDir: string): RawCluster[] {
  if (!existsSync(clustersDir)) {
    return [];
  }

  const files = readdirSync(clustersDir).filter((file) => file.endsWith('.yaml'));
  const clusters: RawCluster[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(clustersDir, file), 'utf-8');
      const parsed = parse(content) as RawCluster;
      if (parsed?.id && parsed?.layer) {
        clusters.push(parsed);
      }
    } catch {
      // Skip invalid cluster files.
    }
  }

  return clusters;
}

export function summarizeCluster(
  cluster: RawCluster,
  limits: Limits
): {
  id: string;
  layer: string;
  layerDetection?: unknown;
  purpose_hint?: string;
  entry_points?: string[];
  imports_external: string[];
  fileCount: number;
  keyPaths: string[];
} {
  const files = Array.isArray(cluster.files) ? cluster.files : [];
  const entryPoints = normalizeStringList(cluster.entry_points);
  const importsExternal = normalizeStringList(cluster.imports?.external).slice(
    0,
    limits.externalImportsTopN
  );
  const keyPaths = extractKeyPaths(files, limits.keyPathsTopN);

  return {
    id: cluster.id ?? 'unknown',
    layer: cluster.layer ?? 'shared',
    ...(cluster.layerDetection ? { layerDetection: cluster.layerDetection } : {}),
    ...(cluster.purpose_hint ? { purpose_hint: cluster.purpose_hint } : {}),
    ...(entryPoints.length > 0 ? { entry_points: entryPoints } : {}),
    imports_external: importsExternal,
    fileCount: files.length,
    keyPaths,
  };
}

export function loadDependencies(
  graphPath: string,
  clusterIds: Set<string>
): { dependencies: Record<string, string[]>; hints: string[] } {
  const hints: string[] = [];

  if (!existsSync(graphPath)) {
    hints.push('dependencies unavailable: graph.yaml missing');
    return { dependencies: {}, hints };
  }

  try {
    const content = readFileSync(graphPath, 'utf-8');
    const graph = parse(content) as GraphData;
    if (!graph?.edges) {
      hints.push('dependencies unavailable: graph.yaml missing edges');
      return { dependencies: {}, hints };
    }

    const dependencyMap: Record<string, string[]> = {};
    for (const edge of graph.edges) {
      if (!edge?.source || !edge?.target) {
        continue;
      }
      if (!clusterIds.has(edge.source) || !clusterIds.has(edge.target)) {
        continue;
      }
      if (!dependencyMap[edge.source]) {
        dependencyMap[edge.source] = [];
      }
      dependencyMap[edge.source].push(edge.target);
    }

    for (const [source, targets] of Object.entries(dependencyMap)) {
      dependencyMap[source] = [...new Set(targets)].sort((a, b) => a.localeCompare(b));
    }

    const sortedKeys = Object.keys(dependencyMap).sort((a, b) => a.localeCompare(b));
    const sortedDependencies: Record<string, string[]> = {};
    for (const key of sortedKeys) {
      sortedDependencies[key] = dependencyMap[key];
    }

    return { dependencies: sortedDependencies, hints };
  } catch {
    hints.push('dependencies unavailable: graph.yaml parse error');
    return { dependencies: {}, hints };
  }
}

function extractKeyPaths(files: string[], topN: number): string[] {
  const counts = new Map<string, number>();

  for (const file of files) {
    const keyPath = getKeyPath(file);
    if (!keyPath) {
      continue;
    }
    counts.set(keyPath, (counts.get(keyPath) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });

  return sorted.slice(0, topN).map(([path]) => path);
}

function getKeyPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return normalized || null;
  }

  const dirSegments = segments.slice(0, -1);
  const prefixSegments = dirSegments.slice(0, 5);
  return prefixSegments.join('/');
}
