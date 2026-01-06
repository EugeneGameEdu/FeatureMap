import { z } from 'zod';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import { normalizeStringList } from '../utils/listUtils.js';
import {
  buildIndices,
  deriveFeatureLayers,
  type DerivedLayer,
} from '../utils/navigationLoaders.js';
import { rankFeatures } from '../utils/searchScoring.js';

const layerEnum = z.enum(['frontend', 'backend', 'shared', 'infrastructure', 'all']);
const parametersSchema = z.object({
  query: z.string().min(1).describe('Free-text query to search for features.'),
  layer: layerEnum.optional().describe('Optional layer filter for features.'),
  groupId: z.string().min(1).optional().describe('Optional group filter for features.'),
});

const DEFAULT_MAX_RESULTS = 20;

export const findRelevantFeaturesTool = {
  name: 'find_relevant_features',
  description:
    'Find features relevant to a natural-language query using deterministic token matching.',
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
    const layerFilter = params.layer && params.layer !== 'all' ? params.layer : null;
    const groupFilter = params.groupId?.trim();

    const features = [...featuresById.values()].filter((feature) => {
      const groupIds = groupIdsByFeatureId.get(feature.id) ?? [];
      if (groupFilter && !groupIds.includes(groupFilter)) {
        return false;
      }

      const layers = deriveFeatureLayers(feature, clustersById);
      if (layerFilter && !layers.includes(layerFilter as DerivedLayer)) {
        return false;
      }

      return true;
    });

    const searchFeatures = features.map((feature) => {
      const clusterIds = normalizeStringList(feature.clusters);
      const clusters = clusterIds.map((clusterId) => ({
        id: clusterId,
        purpose_hint: clustersById.get(clusterId)?.purpose_hint,
      }));

      return {
        id: feature.id,
        name: feature.name,
        description: feature.description,
        clusters,
      };
    });

    const ranked = rankFeatures(params.query, searchFeatures, {
      maxResults: DEFAULT_MAX_RESULTS,
    });

    const result = {
      results: ranked.matches.map(({ id, name, reason }) => ({ id, name, reason })),
      _meta: {
        totalMatches: ranked.totalMatches,
        returnedMatches: ranked.matches.length,
        truncated: ranked.truncated,
        maxResults: DEFAULT_MAX_RESULTS,
        tokens: ranked.tokens,
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
