import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { buildGraph, getGraphStats, type DependencyGraph } from '../analyzer/graph.js';
import { groupByFolders, type Cluster as FolderCluster } from '../analyzer/grouper.js';
import { detectConventions } from '../analyzer/conventions-detector.js';
import { detectTechStack } from '../analyzer/tech-stack-detector.js';
import { loadExistingClusters } from '../analyzer/cluster-loader.js';
import { applyClusterMatching } from '../analyzer/cluster-id-matching.js';
import { loadConfig, scanProject } from '../analyzer/scanner.js';
import { scanProjectStructure } from '../analyzer/structure-scanner.js';
import {
  type Cluster as ClusterFile,
  ClusterSchema,
  ConventionsSchema,
  Graph,
  GraphSchema,
  LayoutSchema,
  TechStackSchema,
  type Layer,
} from '../types/index.js';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import { loadYAML, saveYAML } from '../utils/yaml-loader.js';
import {
  areClustersEquivalent,
  areGraphsEquivalent,
  buildUpdatedMetadata,
} from '../utils/scanCompare.js';
import { buildClusterFile } from '../utils/cluster-builder.js';
import { buildDefaultLayout } from '../utils/layout-builder.js';
import {
  buildConventionsInput,
  findPackageJsonPaths,
  saveAutoContext,
} from '../utils/contextUtils.js';

export function createScanCommand(): Command {
  const command = new Command('scan');

  command
    .description('Scan project and build feature map')
    .option('--ai', 'Start MCP server for AI analysis after scan')
    .action(async (options) => {
      const projectRoot = process.cwd();
      const featuremapDir = path.join(projectRoot, '.featuremap');

      if (!fs.existsSync(featuremapDir)) {
        console.error('ERROR: .featuremap/ not found. Run "featuremap init" first.');
        process.exit(1);
      }

      console.log('Scanning project...\n');

      try {
        migrateLegacyClusters(featuremapDir);
        ensureDirectory(path.join(featuremapDir, 'clusters'));
        ensureDirectory(path.join(featuremapDir, 'features'));
        ensureDirectory(path.join(featuremapDir, 'context'));

        const configPath = path.join(featuremapDir, 'config.yaml');
        const config = loadConfig(configPath);

        if (config.scan.include.length === 0) {
          console.error('ERROR: No include patterns in config.');
          console.error('Run "featuremap init" to generate configuration.');
          process.exit(1);
        }

        const scanResult = await scanProject(projectRoot);
        const tsCount = scanResult.files.length;
        const goCount = scanResult.goFiles?.length ?? 0;
        const totalScannedFiles = tsCount + goCount;

        if (goCount > 0) {
          console.log(`  OK Found ${tsCount} TypeScript files`);
          console.log(`  OK Found ${goCount} Go files`);
        } else {
          console.log(`  OK Found ${tsCount} files`);
        }

        if (totalScannedFiles < 5) {
          const structure = await scanProjectStructure(projectRoot);
          const projectHasMoreFiles = structure.totalFiles > totalScannedFiles;
          if (projectHasMoreFiles) {
            console.warn(`WARNING: Only found ${totalScannedFiles} files.`);
            console.warn('Your config.scan.include patterns might be too restrictive.');
            console.warn('Config format changed. Run "featuremap init" to regenerate.');
          }
        }

        const packageJsonPaths = findPackageJsonPaths(projectRoot);
        const techStack = detectTechStack({ rootDir: projectRoot, packageJsonPaths });
        saveAutoContext(
          path.join(featuremapDir, 'context', 'tech-stack.yaml'),
          techStack,
          TechStackSchema
        );

        const graph = await buildGraph(scanResult);
        const graphStats = getGraphStats(graph);
        console.log(`  OK Built dependency graph (${graphStats.totalDependencies} dependencies)`);

        const existingClusters = loadExistingClusters(path.join(featuremapDir, 'clusters'));
        const grouping = groupByFolders(graph);
        const matching = applyClusterMatching(grouping.clusters, existingClusters);
        const clusters = matching.clusters;
        console.log(`  OK Identified ${clusters.length} clusters`);

        if (existingClusters.length > 0) {
          const stableCount = matching.matchedIds.size;
          const newCount = clusters.length - stableCount;
          console.log(`  INFO ${stableCount} clusters matched, ${newCount} new`);
        }

        for (const match of matching.matches) {
          const confidence = Math.round(match.confidence * 100);
          console.log(
            `  INFO Cluster "${match.suggestedId}" matched to existing "${match.matchedId}" (${confidence}% overlap)`
          );
        }

        if (matching.orphaned.length > 0) {
          console.log(`  WARN ${matching.orphaned.length} clusters no longer exist:`);
          for (const orphan of matching.orphaned) {
            console.log(`    - ${orphan.id}`);
          }
        }

        const clusterSave = saveClusters(featuremapDir, clusters, graph);
        console.log(`  OK Created ${clusterSave.created} cluster files`);
        printLayerSummary(clusterSave.layerSummary);

        saveGraphYaml(featuremapDir, clusters);
        console.log('  OK Generated graph.yaml');

        const conventionsInput = buildConventionsInput(graph);
        const conventions = detectConventions(conventionsInput);
        saveAutoContext(
          path.join(featuremapDir, 'context', 'conventions.yaml'),
          conventions,
          ConventionsSchema
        );
        console.log('  OK Updated project context');

        ensureLayout(featuremapDir, clusters);

        console.log('\nClusters found:');
        for (const cluster of clusters) {
          console.log(`  - ${cluster.name} (${cluster.files.length} files)`);
        }

        console.log('OK Saved to .featuremap/');

        if (options.ai) {
          const separator = '-'.repeat(50);
          console.log(`\n${separator}`);
          console.log('AI Analysis Mode');
          console.log(separator);
          console.log('\nTo group clusters into features with AI, connect the MCP server to your assistant.\n');

          const mcpConfig = {
            mcpServers: {
              featuremap: {
                command: 'node',
                args: [`${process.cwd()}/packages/mcp-server/dist/index.js`],
                cwd: process.cwd(),
              },
            },
          };

          console.log('For Cursor, add to ~/.cursor/mcp.json:');
          console.log('```json');
          console.log(JSON.stringify(mcpConfig, null, 2));
          console.log('```\n');

          console.log('Then ask your AI:');
          console.log('  - "Group the clusters into features and name them"');
          console.log('  - "What features does this project have?"');
          console.log('  - "Explain the architecture based on the clusters"');
          console.log('\nThe AI will use these MCP tools:');
          console.log('  - get_current_features - current feature list');
          console.log('  - update_feature - update names/descriptions');

          const mcpServerPath = path.resolve(
            projectRoot,
            'packages',
            'mcp-server',
            'dist',
            'index.js'
          );
          const mcpServerExists = fs.existsSync(mcpServerPath);
          if (mcpServerExists) {
            console.log(`\nMCP server location: ${mcpServerPath}`);
          } else {
            console.log('\nWarning: MCP server not built. Run: npm run build --workspace=@featuremap/mcp-server');
          }
        }
      } catch (error) {
        console.error('ERROR: Scan failed:', error);
        process.exit(1);
      }
    });

  return command;
}

function migrateLegacyClusters(featuremapDir: string): void {
  const legacyFeaturesDir = path.join(featuremapDir, 'features');
  const clustersDir = path.join(featuremapDir, 'clusters');

  if (fs.existsSync(legacyFeaturesDir) && !fs.existsSync(clustersDir)) {
    fs.renameSync(legacyFeaturesDir, clustersDir);
    console.log('  OK Migrated features/ to clusters/');
  }
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

interface ClusterSaveResult {
  created: number;
  layerSummary: Record<Layer, string[]>;
}

function saveClusters(
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

function buildGraphData(nodes: Graph['nodes'], edges: Graph['edges'], version: number): Graph {
  return {
    version,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
  };
}

function saveGraphYaml(featuremapDir: string, clusters: FolderCluster[]): void {
  const nodes: Graph['nodes'] = clusters.map((cluster) => ({
    id: cluster.id,
    label: cluster.name,
    type: 'cluster',
    fileCount: cluster.files.length,
  }));

  const edges: Array<{ source: string; target: string }> = [];

  for (const cluster of clusters) {
    for (const dep of cluster.externalDependencies) {
      edges.push({
        source: cluster.id,
        target: dep,
      });
    }
  }

  const filePath = path.join(featuremapDir, 'graph.yaml');
  if (fs.existsSync(filePath)) {
    try {
      const existing = loadYAML(filePath, GraphSchema, { fileType: 'graph' });
      const nextGraph = buildGraphData(nodes, edges, existing.version);

      if (areGraphsEquivalent(existing, nextGraph)) {
        return;
      }
    } catch {
      // Fall through to regenerate graph with the latest schema.
    }
  }

  const graphYaml = buildGraphData(nodes, edges, SUPPORTED_VERSIONS.graph);
  saveYAML(filePath, graphYaml, GraphSchema, {
    sortArrayFields: ['nodes', 'edges'],
  });
}

function ensureLayout(featuremapDir: string, clusters: FolderCluster[]): void {
  const layoutPath = path.join(featuremapDir, 'layout.yaml');
  if (fs.existsSync(layoutPath)) {
    return;
  }

  const nodeIds = clusters.map((cluster) => cluster.id);
  const layout = buildDefaultLayout(nodeIds);
  saveYAML(layoutPath, layout, LayoutSchema);
  console.log('  OK Generated layout.yaml');
}

function printLayerSummary(layerSummary: Record<Layer, string[]>): void {
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
