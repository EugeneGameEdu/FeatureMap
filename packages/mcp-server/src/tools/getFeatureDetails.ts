import { z } from 'zod';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import { normalizeStringList } from '../utils/listUtils.js';
import { buildIndices } from '../utils/navigationLoaders.js';
import { filterCommentsForNode, loadComments } from '../utils/commentLoader.js';

const parametersSchema = z.object({
  featureId: z.string().min(1).describe('Feature ID to inspect.'),
});

export const getFeatureDetailsTool = {
  name: 'get_feature_details',
  description: 'Get Level 2 details for a feature and its clusters.',
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
    const feature = featuresById.get(params.featureId);
    if (!feature) {
      const hint = buildFeatureIdHint(params.featureId, featuresById);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Feature "${params.featureId}" not found.${hint}`,
          },
        ],
        isError: true,
      };
    }

    const clusterIds = normalizeStringList(feature.clusters);
    const clusters = clusterIds.map((clusterId) => {
      const cluster = clustersById.get(clusterId);
      const fileCount = Array.isArray(cluster?.files) ? cluster.files.length : 0;
      return {
        id: clusterId,
        layer: cluster?.layer ?? 'unknown',
        purpose_hint: cluster?.purpose_hint ?? null,
        fileCount,
      };
    });

    const dependsOn = normalizeStringList(feature.dependsOn);
    const groupIds = groupIdsByFeatureId.get(feature.id) ?? [];
    const missingClusters = clusterIds.filter((clusterId) => !clustersById.has(clusterId));
    const comments = filterCommentsForNode(loadComments(featuremapDir), 'feature', feature.id);
    const commentIds = comments.map((comment) => comment.id);
    const commentEntries = comments.map((comment) => ({
      id: comment.id,
      homeView: comment.homeView,
      content: comment.content,
      links: comment.links,
      ...(comment.createdAt ? { createdAt: comment.createdAt } : {}),
      ...(comment.updatedAt ? { updatedAt: comment.updatedAt } : {}),
    }));

    const featureDetails = {
      id: feature.id,
      name: feature.name,
      ...(feature.description ? { description: feature.description } : {}),
      ...(feature.purpose ? { purpose: feature.purpose } : {}),
      scope: feature.scope,
      status: feature.status,
      source: feature.source,
      ...(dependsOn.length > 0 ? { dependsOn } : {}),
      composition: feature.composition,
      ...(feature.locks ? { locks: feature.locks } : {}),
      metadata: feature.metadata,
    };

    const result = {
      feature: featureDetails,
      clusters,
      groupIds,
      commentIds,
      commentCount: commentIds.length,
      comments: commentEntries,
      _meta: {
        clusterCount: clusters.length,
        missingClusters,
        hints: {
          commentsTool: `Use get_node_comments(feature,${feature.id}) for truncation or metadata-only access`,
        },
      },
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};

function buildFeatureIdHint(
  featureId: string,
  featuresById: Map<string, { id: string }>
): string {
  const normalized = featureId.toLowerCase();
  const ids = [...featuresById.keys()];
  const matches = ids
    .filter((id) => id.toLowerCase().includes(normalized))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 5);

  if (matches.length === 0) {
    return '';
  }

  return ` Closest ids: ${matches.join(', ')}.`;
}
