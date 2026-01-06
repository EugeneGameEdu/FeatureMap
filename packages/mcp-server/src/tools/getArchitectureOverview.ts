import { z } from 'zod';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import { normalizeStringList } from '../utils/listUtils.js';
import {
  buildIndices,
  deriveFeatureLayers,
  type DerivedLayer,
} from '../utils/navigationLoaders.js';

const layerEnum = z.enum(['frontend', 'backend', 'shared', 'infrastructure', 'all']);
const parametersSchema = z.object({
  layer: layerEnum.optional().describe('Optional layer filter for features.'),
  groupId: z.string().min(1).optional().describe('Optional group filter for features.'),
});

export const getArchitectureOverviewTool = {
  name: 'get_architecture_overview',
  description:
    'Get a Level 1 summary of the architecture: features with scope, layers, status, source, groups, and counts.',
  parameters: parametersSchema.shape,
  execute: async (params: z.infer<typeof parametersSchema>) => {
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

    const { featuresById, clustersById, groupIdsByFeatureId } = buildIndices(featuremapDir);
    const totalFeatures = featuresById.size;
    const totalClusters = clustersById.size;
    const totalFiles = countClusterFiles(clustersById);

    const layerFilter = params.layer && params.layer !== 'all' ? params.layer : null;
    const groupFilter = params.groupId?.trim();

    const featureIds = [...featuresById.keys()].sort((a, b) => a.localeCompare(b));
    const features = featureIds
      .map((featureId) => {
        const feature = featuresById.get(featureId);
        if (!feature) {
          return null;
        }

        const groupIds = groupIdsByFeatureId.get(featureId) ?? [];
        if (groupFilter && !groupIds.includes(groupFilter)) {
          return null;
        }

        const layers = deriveFeatureLayers(feature, clustersById);
        if (layerFilter && !layers.includes(layerFilter as DerivedLayer)) {
          return null;
        }

        const dependsOn = normalizeStringList(feature.dependsOn);
        const description = truncateText(feature.description, 160);

        return {
          id: feature.id,
          name: feature.name,
          ...(description ? { description } : {}),
          scope: feature.scope,
          layers,
          status: feature.status,
          source: feature.source,
          ...(groupIds.length > 0 ? { groupIds } : {}),
          ...(dependsOn.length > 0 ? { dependsOn } : {}),
        };
      })
      .filter((feature): feature is NonNullable<typeof feature> => feature !== null);

    const result = {
      features,
      counts: {
        totalFeatures,
        totalClusters,
        totalFiles,
      },
      _meta: {
        returnedFeatures: features.length,
        appliedFilters: {
          layer: layerFilter ?? 'all',
          groupId: groupFilter ?? null,
        },
      },
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};

function countClusterFiles(clustersById: Map<string, { files?: string[] }>): number {
  let total = 0;
  for (const cluster of clustersById.values()) {
    if (Array.isArray(cluster.files)) {
      total += cluster.files.length;
    }
  }
  return total;
}

function truncateText(value: string | undefined, maxLength: number): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
