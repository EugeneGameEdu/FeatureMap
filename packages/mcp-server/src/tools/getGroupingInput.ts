import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { z } from 'zod';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import { loadProjectContext } from '../utils/contextLoader.js';

const layerEnum = z.enum(['frontend', 'backend', 'shared', 'infrastructure']);
const limitsSchema = z.object({
  externalImportsTopN: z.number().int().positive().max(100).optional(),
  keyPathsTopN: z.number().int().positive().max(50).optional(),
  maxClusters: z.number().int().positive().max(500).optional(),
});

const DEFAULT_LIMITS = {
  externalImportsTopN: 10,
  keyPathsTopN: 5,
  maxClusters: 200,
};

type Limits = typeof DEFAULT_LIMITS;

interface RawCluster {
  id?: string;
  layer?: string;
  layerDetection?: unknown;
  purpose_hint?: string;
  entry_points?: string[];
  imports?: { external?: string[] };
  files?: string[];
}

interface RawFeature {
  id?: string;
  name?: string;
  scope?: string;
  status?: string;
  clusters?: string[];
}

interface GraphData {
  edges?: Array<{ source?: string; target?: string }>;
}

export const getGroupingInputTool = {
  name: 'get_grouping_input',
  description: `Get a compact, model-friendly snapshot of clusters and context for feature grouping.

Guidance for AI usage:
- Group by PURPOSE, not by folder/module names.
- Aim for 3–7 high-level features.
- Features should be understandable to non-programmers.
- After analysis, call save_features_from_grouping (next step).`,
  parameters: {
    layer: layerEnum.optional().describe('Optional layer filter for clusters.'),
    includeExistingFeatures: z
      .boolean()
      .optional()
      .describe('Include existing feature summaries if available. Defaults to true.'),
    limits: limitsSchema.optional().describe('Payload limits to keep responses small.'),
  },
  execute: async (params: {
    layer?: z.infer<typeof layerEnum>;
    includeExistingFeatures?: boolean;
    limits?: Partial<Limits>;
  }) => {
    const featuremapDir = findFeaturemapDir();
    if (!featuremapDir) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Error: No .featuremap directory found. Run "featuremap init" first.',
          },
        ],
        isError: true,
      };
    }

    const limits = applyLimits(params.limits);
    const rawClusters = loadClusters(join(featuremapDir, 'clusters'));
    const filteredClusters = params.layer
      ? rawClusters.filter((cluster) => cluster.layer === params.layer)
      : rawClusters;
    const sortedClusters = [...filteredClusters].sort((a, b) =>
      (a.id ?? '').localeCompare(b.id ?? '')
    );

    const truncated = sortedClusters.length > limits.maxClusters;
    const slicedClusters = sortedClusters.slice(0, limits.maxClusters);
    const clusterSummaries = slicedClusters.map((cluster) => summarizeCluster(cluster, limits));
    const clusterIdSet = new Set(clusterSummaries.map((cluster) => cluster.id));

    const dependencyResult = loadDependencies(
      join(featuremapDir, 'graph.yaml'),
      clusterIdSet
    );
    const metaHints = [...dependencyResult.hints];
    if (truncated) {
      metaHints.push(`clusters truncated to maxClusters=${limits.maxClusters}`);
    }
    if (params.layer) {
      metaHints.push(`layer filter applied: ${params.layer}`);
    }

    const context = loadProjectContext(featuremapDir);
    const includeExistingFeatures = params.includeExistingFeatures !== false;
    const existingFeatures = includeExistingFeatures
      ? loadExistingFeatures(join(featuremapDir, 'features'))
      : [];

    const result = {
      clusters: clusterSummaries,
      dependencies: dependencyResult.dependencies,
      context: {
        tech_stack: context.techStack,
        conventions: context.conventions,
      },
      existing_features: existingFeatures,
      _meta: {
        counts: {
          clustersTotal: rawClusters.length,
          clustersFiltered: filteredClusters.length,
          clustersReturned: clusterSummaries.length,
          existingFeatures: existingFeatures.length,
        },
        appliedFilters: {
          layer: params.layer ?? null,
        },
        limits: { ...limits },
        truncation: {
          clusters: truncated,
        },
        hints: metaHints,
      },
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};

function applyLimits(limits?: Partial<Limits>): Limits {
  return {
    externalImportsTopN: limits?.externalImportsTopN ?? DEFAULT_LIMITS.externalImportsTopN,
    keyPathsTopN: limits?.keyPathsTopN ?? DEFAULT_LIMITS.keyPathsTopN,
    maxClusters: limits?.maxClusters ?? DEFAULT_LIMITS.maxClusters,
  };
}

function loadClusters(clustersDir: string): RawCluster[] {
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

function loadExistingFeatures(featuresDir: string): Array<{
  id: string;
  name: string;
  scope?: string;
  status?: string;
  clusters: string[];
}> {
  if (!existsSync(featuresDir)) {
    return [];
  }

  const files = readdirSync(featuresDir).filter((file) => file.endsWith('.yaml'));
  const features: Array<{
    id: string;
    name: string;
    scope?: string;
    status?: string;
    clusters: string[];
  }> = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(featuresDir, file), 'utf-8');
      const parsed = parse(content) as RawFeature;
      if (!parsed?.id || !parsed?.name) {
        continue;
      }
      features.push({
        id: parsed.id,
        name: parsed.name,
        scope: parsed.scope,
        status: parsed.status,
        clusters: Array.isArray(parsed.clusters)
          ? [...new Set(parsed.clusters)].sort((a, b) => a.localeCompare(b))
          : [],
      });
    } catch {
      // Skip invalid feature files.
    }
  }

  return features.sort((a, b) => a.id.localeCompare(b.id));
}

function summarizeCluster(cluster: RawCluster, limits: Limits): {
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

function normalizeStringList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
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

function loadDependencies(
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
