import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { z } from 'zod';
import { executeScan } from '../utils/scanExecutor.js';

export const runScanTool = {
  name: 'run_scan',
  description: `Run technical scan to parse code and create clusters.

WHEN TO USE:
- After save_project_config created the configuration
- When user asks to "rescan", "update scan", "refresh clusters"
- After code changes that need to be reflected in the map

WHAT IT DOES:
- Reads config.yaml for include/exclude patterns
- Parses all matching files (TypeScript, JavaScript, Go)
- Creates/updates cluster files in .featuremap/clusters/
- Builds dependency graph
- Updates tech-stack.yaml and conventions.yaml

RETURNS:
- Statistics: files scanned, clusters created, dependencies found
- Layer summary: how many clusters per layer (frontend/backend/shared/infrastructure)
- Any warnings or errors

NEXT STEPS:
- If first scan: suggest calling get_grouping_input -> save_features_from_grouping
- If rescan: show what changed (new/modified/deleted clusters)`,
  parameters: {
    projectRoot: z.string().optional().describe('Project root, defaults to cwd'),
  },
  execute: async (params: { projectRoot?: string }) => {
    const projectRoot = params.projectRoot ? resolve(params.projectRoot) : process.cwd();
    const featuremapDir = join(projectRoot, '.featuremap');
    const configPath = join(featuremapDir, 'config.yaml');

    if (!existsSync(configPath)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: false,
                error: 'No config.yaml found. Call save_project_config first.',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    const clustersDir = join(featuremapDir, 'clusters');
    const existingClusterIds = readClusterIds(clustersDir);

    try {
      const result = await executeScan(projectRoot);
      const added = result.clusterIds.filter((id) => !existingClusterIds.includes(id));
      const removed = existingClusterIds.filter((id) => !result.clusterIds.includes(id));
      const unchanged = result.clusterIds.filter((id) => existingClusterIds.includes(id));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                message: 'Scan completed successfully.',
                statistics: {
                  filesScanned: result.filesScanned,
                  clustersTotal: result.clusterIds.length,
                  dependenciesFound: result.dependenciesCount,
                },
                changes: {
                  added: added.length,
                  unchanged: unchanged.length,
                  removed: removed.length,
                  addedClusters: added,
                  removedClusters: removed,
                },
                layerSummary: result.layerSummary,
                warnings: result.warnings,
                nextStep:
                  existingClusterIds.length === 0
                    ? {
                        action: 'Create features from clusters',
                        description:
                          'Group these technical clusters into architectural features',
                        call: 'get_grouping_input',
                        thenCall: 'save_features_from_grouping',
                      }
                    : {
                        action: 'Review changes',
                        description:
                          'Check if features need updating based on cluster changes',
                        call: 'get_current_features',
                      },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: false,
                error: `Scan failed: ${message}`,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  },
};

function readClusterIds(clustersDir: string): string[] {
  if (!existsSync(clustersDir)) {
    return [];
  }

  return readdirSync(clustersDir)
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => file.replace(/\.yaml$/, ''))
    .sort((a, b) => a.localeCompare(b));
}
