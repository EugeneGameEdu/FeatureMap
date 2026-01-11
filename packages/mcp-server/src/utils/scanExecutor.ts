import { existsSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';
import {
  applyClusterMatching,
  areClustersEquivalent,
  buildClusterFile,
  buildConventionsInput,
  buildDefaultLayout,
  buildUpdatedMetadata,
  buildGraph,
  detectConventions,
  detectTechStack,
  findPackageJsonPaths,
  getGraphStats,
  groupByFolders,
  loadExistingClusters,
  loadYAML,
  saveAutoContext,
  saveYAML,
  saveGraphYaml,
  scanProject,
  scanProjectStructure,
  ClusterSchema,
  ConventionsSchema,
  LayoutSchema,
  TechStackSchema,
} from '@featuremap/cli/dist/api.js';
import type {
  ClusterFile,
  DependencyGraph,
  FolderCluster,
  Layer,
} from '@featuremap/cli/dist/api.js';

export interface ScanExecutionResult {
  filesScanned: number;
  dependenciesCount: number;
  clusterIds: string[];
  layerSummary: Record<Layer, number>;
  warnings: string[];
  orphanedClusterIds: string[];
}

export async function executeScan(projectRoot: string): Promise<ScanExecutionResult> {
  const featuremapDir = join(projectRoot, '.featuremap');
  const warnings: string[] = [];

  migrateLegacyClusters(featuremapDir);
  ensureDirectory(join(featuremapDir, 'clusters'));
  ensureDirectory(join(featuremapDir, 'features'));
  ensureDirectory(join(featuremapDir, 'context'));

  const scanResult = await scanProject(projectRoot);

  if (scanResult.config.scan.include.length === 0) {
    throw new Error('No include patterns in config. Run save_project_config first.');
  }

  const tsCount = scanResult.files.length;
  const goCount = scanResult.goFiles?.length ?? 0;
  const totalScannedFiles = tsCount + goCount;

  if (totalScannedFiles < 5) {
    const structure = await scanProjectStructure(projectRoot);
    if (structure.totalFiles > totalScannedFiles) {
      warnings.push(
        `Only found ${totalScannedFiles} files. Config include patterns may be too restrictive.`
      );
    }
  }

  const packageJsonPaths = findPackageJsonPaths(projectRoot);
  const techStack = detectTechStack({ rootDir: projectRoot, packageJsonPaths });
  saveAutoContext(join(featuremapDir, 'context', 'tech-stack.yaml'), techStack, TechStackSchema);

  const graph = await buildGraph(scanResult);
  const graphStats = getGraphStats(graph);

  const clustersDir = join(featuremapDir, 'clusters');
  const existingClusters = loadExistingClusters(clustersDir);
  const grouping = groupByFolders(graph);
  const matching = applyClusterMatching(grouping.clusters, existingClusters);
  const clusters = matching.clusters;

  if (matching.orphaned.length > 0) {
    const orphanedIds = matching.orphaned.map((orphan) => orphan.id);
    warnings.push(`Orphaned clusters detected: ${orphanedIds.join(', ')}`);
  }

  const clusterSave = saveClusters(featuremapDir, clusters, graph);
  saveGraphYaml(featuremapDir, clusters, graph);

  const conventionsInput = buildConventionsInput(graph);
  const conventions = detectConventions(conventionsInput);
  saveAutoContext(
    join(featuremapDir, 'context', 'conventions.yaml'),
    conventions,
    ConventionsSchema
  );

  ensureLayout(featuremapDir, clusters);

  return {
    filesScanned: totalScannedFiles,
    dependenciesCount: graphStats.totalDependencies,
    clusterIds: clusters.map((cluster) => cluster.id),
    layerSummary: countLayerSummary(clusterSave.layerSummary),
    warnings,
    orphanedClusterIds: matching.orphaned.map((orphan) => orphan.id),
  };
}

interface ClusterSaveResult {
  created: number;
  layerSummary: Record<Layer, string[]>;
}

function migrateLegacyClusters(featuremapDir: string): void {
  const legacyFeaturesDir = join(featuremapDir, 'features');
  const clustersDir = join(featuremapDir, 'clusters');

  if (existsSync(legacyFeaturesDir) && !existsSync(clustersDir)) {
    renameSync(legacyFeaturesDir, clustersDir);
  }
}

function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function saveClusters(
  featuremapDir: string,
  clusters: FolderCluster[],
  graph: DependencyGraph
): ClusterSaveResult {
  const clustersDir = join(featuremapDir, 'clusters');
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
    const clusterFile = join(clustersDir, `${cluster.id}.yaml`);
    const isNewCluster = !existsSync(clusterFile);
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
      created += 1;
    }
  }

  for (const layer of Object.keys(layerSummary) as Layer[]) {
    layerSummary[layer].sort((a, b) => a.localeCompare(b));
  }

  return { created, layerSummary };
}

function ensureLayout(featuremapDir: string, clusters: FolderCluster[]): void {
  const layoutPath = join(featuremapDir, 'layout.yaml');
  if (existsSync(layoutPath)) {
    return;
  }

  const nodeIds = clusters.map((cluster) => cluster.id);
  const layout = buildDefaultLayout(nodeIds);
  saveYAML(layoutPath, layout, LayoutSchema);
}

function countLayerSummary(layerSummary: Record<Layer, string[]>): Record<Layer, number> {
  const counts = {} as Record<Layer, number>;
  for (const [layer, clusters] of Object.entries(layerSummary) as Array<[Layer, string[]]>) {
    counts[layer] = clusters.length;
  }
  return counts;
}
