import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { loadYAML } from '../utils/yaml-loader.js';
import { ClusterSchema } from '../types/cluster.js';

export interface ExistingClusterInfo {
  id: string;
  files: string[];
  compositionHash: string;
}

export function loadExistingClusters(clustersDir: string): ExistingClusterInfo[] {
  if (!existsSync(clustersDir)) {
    return [];
  }

  const files = readdirSync(clustersDir).filter((file) => file.endsWith('.yaml'));
  const clusters: ExistingClusterInfo[] = [];

  for (const file of files) {
    try {
      const cluster = loadYAML(join(clustersDir, file), ClusterSchema, {
        skipVersionCheck: true,
      });
      clusters.push({
        id: cluster.id,
        files: cluster.files,
        compositionHash: cluster.compositionHash,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`WARN Could not load cluster ${file}: ${message}`);
    }
  }

  return clusters;
}
