import { join } from 'path';
import { z } from 'zod';
import type { ClusterInfo, FeatureFile, FeatureLocks } from '../types/feature.js';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import { loadProjectContext } from '../utils/contextLoader.js';
import { loadFeatures } from '../utils/featureLoader.js';
import { normalizeStringList } from '../utils/listUtils.js';
import { computeFeatureCompositionHash } from '../utils/featureMerge.js';
import {
  applyLimits,
  loadClusters,
  loadDependencies,
  summarizeCluster,
  type Limits,
  type RawCluster,
} from './getGroupingInputUtils.js';

const layerEnum = z.enum(['frontend', 'backend', 'shared', 'infrastructure']);
const limitsSchema = z.object({
  externalImportsTopN: z.number().int().positive().max(100).optional(),
  keyPathsTopN: z.number().int().positive().max(50).optional(),
  maxClusters: z.number().int().positive().max(500).optional(),
});

interface ExistingFeatureSummary {
  id: string;
  name: string;
  scope?: string;
  status?: string;
  clusters: string[];
  composition: { hash: string; currentHash: string; isStale: boolean };
  locks?: Pick<FeatureLocks, 'name' | 'description' | 'clusters'>;
}

export const getGroupingInputTool = {
  name: 'get_grouping_input',
  description: `Get a compact, model-friendly snapshot of clusters and context for feature grouping.

Guidance for AI usage:
- Group by PURPOSE, not by folder/module names.
- Aim for 3-7 high-level features.
- Features should be understandable to non-programmers.
- If stability.staleFeatureIds is empty, do not change features; avoid renames or reclustering.
- If some features are stale, update only those features unless the user explicitly requests a regroup.
- Preserve existing feature IDs whenever possible.
- Respect locks (name/description/clusters) when proposing updates.
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
    const rawClusters = loadClusters(featuremapDir);
    const clustersById = buildClusterInfoMap(rawClusters);
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
      ? buildExistingFeatureSummaries(
          loadFeatures(join(featuremapDir, 'features')),
          clustersById
        )
      : [];
    const stability = buildStabilitySummary(existingFeatures);

    const result = {
      clusters: clusterSummaries,
      dependencies: dependencyResult.dependencies,
      context: {
        tech_stack: context.techStack,
        conventions: context.conventions,
      },
      existing_features: existingFeatures,
      stability,
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

function buildClusterInfoMap(rawClusters: RawCluster[]): Map<string, ClusterInfo> {
  const clustersById = new Map<string, ClusterInfo>();

  for (const cluster of rawClusters) {
    if (!cluster.id) {
      continue;
    }
    clustersById.set(cluster.id, {
      id: cluster.id,
      layer: cluster.layer,
      files: Array.isArray(cluster.files) ? cluster.files : [],
      compositionHash: cluster.compositionHash,
    });
  }

  return clustersById;
}

function buildExistingFeatureSummaries(
  existingFeatures: Map<string, FeatureFile>,
  clustersById: Map<string, ClusterInfo>
): ExistingFeatureSummary[] {
  const summaries: ExistingFeatureSummary[] = [];

  for (const feature of existingFeatures.values()) {
    if (!feature?.id || !feature?.name) {
      continue;
    }

    const clusters = normalizeStringList(feature.clusters);
    const storedHash = feature.composition?.hash ?? '';
    const currentHash = computeFeatureCompositionHash(clusters, clustersById, []);
    const locks = pickLocks(feature.locks);

    summaries.push({
      id: feature.id,
      name: feature.name,
      scope: feature.scope,
      status: feature.status,
      clusters,
      composition: {
        hash: storedHash,
        currentHash,
        isStale: storedHash !== currentHash,
      },
      ...(locks ? { locks } : {}),
    });
  }

  return summaries.sort((a, b) => a.id.localeCompare(b.id));
}

function buildStabilitySummary(existingFeatures: ExistingFeatureSummary[]): {
  staleFeatureIds: string[];
  staleCount: number;
  totalFeatures: number;
} {
  const staleFeatureIds = existingFeatures
    .filter((feature) => feature.composition.isStale)
    .map((feature) => feature.id)
    .sort((a, b) => a.localeCompare(b));

  return {
    staleFeatureIds,
    staleCount: staleFeatureIds.length,
    totalFeatures: existingFeatures.length,
  };
}

function pickLocks(
  locks: FeatureLocks | undefined
): ExistingFeatureSummary['locks'] | undefined {
  if (!locks) {
    return undefined;
  }

  const selected: ExistingFeatureSummary['locks'] = {};
  if (locks.name) {
    selected.name = true;
  }
  if (locks.description) {
    selected.description = true;
  }
  if (locks.clusters) {
    selected.clusters = true;
  }

  return Object.keys(selected).length > 0 ? selected : undefined;
}
