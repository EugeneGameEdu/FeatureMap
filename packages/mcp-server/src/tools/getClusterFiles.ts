import { z } from 'zod';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import { buildGroupNotePreviews, buildGroupSummaries } from '../utils/groupNotes.js';
import { normalizeStringList } from '../utils/listUtils.js';
import { buildIndices } from '../utils/navigationLoaders.js';
import { filterCommentsForNode, loadComments } from '../utils/commentLoader.js';

const parametersSchema = z.object({
  clusterId: z.string().min(1).describe('Cluster ID to inspect.'),
  maxFiles: z.number().int().positive().max(1000).optional().describe('Max files to return.'),
});

const DEFAULT_MAX_FILES = 200;

export const getClusterFilesTool = {
  name: 'get_cluster_files',
  description: 'Get Level 3 detail: cluster metadata and file list.',
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

    const { clustersById, featuresById, groupsById, groupIdsByFeatureId } =
      buildIndices(featuremapDir);
    const cluster = clustersById.get(params.clusterId);
    if (!cluster) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Cluster "${params.clusterId}" not found.`,
          },
        ],
        isError: true,
      };
    }

    const files = normalizeStringList(cluster.files);
    const maxFiles = params.maxFiles ?? DEFAULT_MAX_FILES;
    const truncated = files.length > maxFiles;
    const filesReturned = files.slice(0, maxFiles);
    const entryPoints = normalizeStringList(cluster.entry_points);
    const importsExternal = normalizeStringList(cluster.imports?.external);
    const exportsCount = Array.isArray(cluster.exports) ? cluster.exports.length : 0;
    const featureIds = findFeatureIdsForCluster(featuresById, cluster.id ?? params.clusterId);
    const groupIds = collectGroupIds(featureIds, groupIdsByFeatureId);
    const groups = buildGroupSummaries(groupIds, groupsById);
    const groupNotes = buildGroupNotePreviews(groupIds, groupsById);
    const comments = filterCommentsForNode(
      loadComments(featuremapDir),
      'cluster',
      cluster.id ?? params.clusterId
    );
    const commentIds = comments.map((comment) => comment.id);
    const commentEntries = comments.map((comment) => ({
      id: comment.id,
      homeView: comment.homeView,
      content: comment.content,
      links: comment.links,
      ...(comment.createdAt ? { createdAt: comment.createdAt } : {}),
      ...(comment.updatedAt ? { updatedAt: comment.updatedAt } : {}),
    }));

    const result = {
      cluster: {
        id: cluster.id ?? params.clusterId,
        layer: cluster.layer ?? 'unknown',
        ...(cluster.purpose_hint ? { purpose_hint: cluster.purpose_hint } : {}),
        ...(entryPoints.length > 0 ? { entry_points: entryPoints } : {}),
        ...(importsExternal.length > 0 ? { imports_external: importsExternal } : {}),
        exportsCount,
      },
      featureIds,
      groups,
      groupIds,
      groupNotes,
      files: filesReturned,
      commentIds,
      commentCount: commentIds.length,
      comments: commentEntries,
      _meta: {
        totalFiles: files.length,
        returnedFiles: filesReturned.length,
        truncated,
        maxFiles,
        hints: {
          commentsTool: `Use get_node_comments(cluster,${cluster.id ?? params.clusterId}) for truncation or metadata-only access`,
          groupDetailsTool: 'Use get_group_details(groupId) for full group note context',
        },
      },
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};

function findFeatureIdsForCluster(
  featuresById: Map<string, { id?: string; clusters?: string[] }>,
  clusterId: string
): string[] {
  const featureIds: string[] = [];

  for (const feature of featuresById.values()) {
    const clusters = normalizeStringList(feature.clusters);
    if (clusters.includes(clusterId)) {
      featureIds.push(feature.id ?? '');
    }
  }

  return normalizeStringList(featureIds.filter((id) => id.length > 0));
}

function collectGroupIds(
  featureIds: string[],
  groupIdsByFeatureId: Map<string, string[]>
): string[] {
  const groupIds = new Set<string>();

  for (const featureId of featureIds) {
    const ids = groupIdsByFeatureId.get(featureId) ?? [];
    for (const groupId of ids) {
      groupIds.add(groupId);
    }
  }

  return normalizeStringList([...groupIds]);
}
