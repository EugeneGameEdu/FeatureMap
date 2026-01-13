import * as fs from 'fs';
import * as path from 'path';
import type { DependencyGraph } from '../analyzer/graph.js';
import type { Cluster as FolderCluster } from '../analyzer/grouper.js';
import {
  ClusterSchema,
  LayoutSchema,
  type Cluster as ClusterFile,
  type Layer,
} from '../types/index.js';
import { loadYAML, saveYAML } from '../utils/yaml-loader.js';
import { areClustersEquivalent, buildUpdatedMetadata } from '../utils/scanCompare.js';
import { buildClusterFile } from '../utils/cluster-builder.js';
import { buildDefaultLayout } from '../utils/layout-builder.js';

export interface ClusterSaveResult {
  created: number;
  layerSummary: Record<Layer, string[]>;
}

export function migrateLegacyClusters(featuremapDir: string): void {
  const legacyFeaturesDir = path.join(featuremapDir, 'features');
  const clustersDir = path.join(featuremapDir, 'clusters');

  if (fs.existsSync(legacyFeaturesDir) && !fs.existsSync(clustersDir)) {
    fs.renameSync(legacyFeaturesDir, clustersDir);
    console.log('  OK Migrated features/ to clusters/');
  }
}

export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function saveClusters(
  featuremapDir: string,
  clusters: FolderCluster[],
  graph: DependencyGraph
): ClusterSaveResult {
  const clustersDir = path.join(featuremapDir, 'clusters');
  let created = 0;
  const layerSummary: Record<Layer, string[]> = {
    frontend: [],
    backend: [],
    fullstack: [],
    shared: [],
    infrastructure: [],
    smell: [],
  };

  for (const cluster of clusters) {
    const clusterFile = path.join(clustersDir, `${cluster.id}.yaml`);
    const isNewCluster = !fs.existsSync(clusterFile);
    let versionInjected = false;
    let existing: ClusterFile | null = null;

    if (!isNewCluster) {
      try {
        existing = loadYAML(clusterFile, ClusterSchema, {
          fileType: 'cluster',
          allowMissingVersion: true,
          onVersionInjected: () => {
            versionInjected = true;
          },
        });
      } catch {
        existing = null;
      }
    }

    const baseMetadata = existing?.metadata ?? buildUpdatedMetadata(undefined);
    const nextCluster = buildClusterFile(cluster, graph, {
      metadata: baseMetadata,
      version: existing?.version,
      purpose_hint: existing?.purpose_hint,
      entry_points: existing?.entry_points,
      existingCluster: existing,
    });
    const contentChanged = !existing || !areClustersEquivalent(existing, nextCluster);
    const shouldWrite = contentChanged || versionInjected;

    layerSummary[nextCluster.layer].push(nextCluster.id);

    if (!shouldWrite) {
      continue;
    }

    if (contentChanged) {
      nextCluster.metadata = buildUpdatedMetadata(existing?.metadata);
    } else if (existing?.metadata) {
      nextCluster.metadata = existing.metadata;
    }

    saveYAML(clusterFile, nextCluster, ClusterSchema, {
      sortArrayFields: ['files', 'exports', 'entry_points', 'internal', 'external'],
    });

    if (isNewCluster) {
      created++;
    }
  }

  for (const layer of Object.keys(layerSummary) as Layer[]) {
    layerSummary[layer].sort((a, b) => a.localeCompare(b));
  }

  return { created, layerSummary };
}

export function ensureLayout(featuremapDir: string, clusters: FolderCluster[]): void {
  const layoutPath = path.join(featuremapDir, 'layout.yaml');
  if (fs.existsSync(layoutPath)) {
    return;
  }

  const nodeIds = clusters.map((cluster) => cluster.id);
  const layout = buildDefaultLayout(nodeIds);
  saveYAML(layoutPath, layout, LayoutSchema);
  console.log('  OK Generated layout.yaml');
}

export function printLayerSummary(layerSummary: Record<Layer, string[]>): void {
  console.log('\nLayer distribution:');
  const order: Layer[] = [
    'frontend',
    'backend',
    'fullstack',
    'shared',
    'infrastructure',
    'smell',
  ];

  for (const layer of order) {
    const clusters = layerSummary[layer];
    if (!clusters || clusters.length === 0) {
      console.log(`  - ${layer}: 0 clusters`);
      continue;
    }
    console.log(`  - ${layer}: ${clusters.length} clusters (${clusters.join(', ')})`);
  }
  console.log('');
}
