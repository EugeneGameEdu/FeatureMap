import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { buildGraph, getGraphStats, type DependencyGraph } from '../analyzer/graph.js';
import { groupByFolders, type Cluster as FolderCluster } from '../analyzer/grouper.js';
import { scanProject } from '../analyzer/scanner.js';
import { type Cluster as ClusterFile, ClusterSchema, Graph, GraphSchema, LayoutSchema } from '../types/index.js';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import { loadYAML, saveYAML } from '../utils/yaml-loader.js';
import {
  areClustersEquivalent,
  areGraphsEquivalent,
  buildUpdatedMetadata,
} from '../utils/scanCompare.js';
import { buildClusterFile } from '../utils/cluster-builder.js';
import { buildDefaultLayout } from '../utils/layout-builder.js';

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

        const scanResult = await scanProject(projectRoot);
        console.log(`  OK Found ${scanResult.files.length} files`);

        const graph = await buildGraph(scanResult);
        const graphStats = getGraphStats(graph);
        console.log(`  OK Built dependency graph (${graphStats.totalDependencies} dependencies)`);

        const grouping = groupByFolders(graph);
        console.log(`  OK Identified ${grouping.clusters.length} clusters`);

        const clustersCreated = saveClusters(featuremapDir, grouping.clusters, graph);
        console.log(`  OK Created ${clustersCreated} cluster files`);

        saveGraphYaml(featuremapDir, grouping.clusters);
        console.log('  OK Generated graph.yaml');

        ensureLayout(featuremapDir, grouping.clusters);

        console.log('\nClusters found:');
        for (const cluster of grouping.clusters) {
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

function saveClusters(
  featuremapDir: string,
  clusters: FolderCluster[],
  graph: DependencyGraph
): number {
  const clustersDir = path.join(featuremapDir, 'clusters');
  let created = 0;

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
    });
    const contentChanged = !existing || !areClustersEquivalent(existing, nextCluster);
    const shouldWrite = contentChanged || versionInjected;

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

  return created;
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
