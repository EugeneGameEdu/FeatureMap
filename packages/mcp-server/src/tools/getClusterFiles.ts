import { z } from 'zod';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import { normalizeStringList } from '../utils/listUtils.js';
import { buildIndices } from '../utils/navigationLoaders.js';

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

    const { clustersById } = buildIndices(featuremapDir);
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

    const result = {
      cluster: {
        id: cluster.id ?? params.clusterId,
        layer: cluster.layer ?? 'unknown',
        ...(cluster.purpose_hint ? { purpose_hint: cluster.purpose_hint } : {}),
        ...(entryPoints.length > 0 ? { entry_points: entryPoints } : {}),
        ...(importsExternal.length > 0 ? { imports_external: importsExternal } : {}),
        exportsCount,
      },
      files: filesReturned,
      _meta: {
        totalFiles: files.length,
        returnedFiles: filesReturned.length,
        truncated,
        maxFiles,
      },
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
