import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { scanProject } from '../analyzer/scanner.js';
import { buildGraph, getGraphStats } from '../analyzer/graph.js';
import { groupByFolders, Cluster } from '../analyzer/grouper.js';
import { Feature, FeatureSchema, Graph, GraphSchema } from '../types/index.js';
import { loadYAML, saveYAML } from '../utils/yaml-loader.js';
import {
  areFeaturesEquivalent,
  areGraphsEquivalent,
  buildUpdatedMetadata,
} from '../utils/scanCompare.js';

export function createScanCommand(): Command {
  const command = new Command('scan');

  command
    .description('Scan project and build feature map')
    .option('--ai', 'Start MCP server for AI analysis after scan')
    .action(async (options) => {
      const projectRoot = process.cwd();
      const featuremapDir = path.join(projectRoot, '.featuremap');

      if (!fs.existsSync(featuremapDir)) {
        console.error('❌ .featuremap/ not found. Run "featuremap init" first.');
        process.exit(1);
      }

      console.log('Scanning project...\n');

      try {
        const scanResult = await scanProject(projectRoot);
        console.log(`  ✓ Found ${scanResult.files.length} files`);

        const graph = await buildGraph(scanResult);
        const graphStats = getGraphStats(graph);
        console.log(`  ✓ Built dependency graph (${graphStats.totalDependencies} dependencies)`);

        const grouping = groupByFolders(graph);
        console.log(`  ✓ Identified ${grouping.clusters.length} feature clusters`);


        const featuresCreated = saveFeatures(featuremapDir, grouping.clusters);
        console.log(`  ✓ Created ${featuresCreated} feature files`);

        saveGraphYaml(featuremapDir, grouping.clusters);
        console.log('  ✓ Generated graph.yaml');

        console.log('\nFeatures found:');
        for (const cluster of grouping.clusters) {
          console.log(`  • ${cluster.name} (${cluster.files.length} files)`);
        }

        console.log('✓ Saved to .featuremap/');

        if (options.ai) {
          const separator = '─'.repeat(50);
          console.log(`\n${separator}`);
          console.log('🤖 AI Analysis Mode');
          console.log(separator);
          console.log('\nTo analyze features with AI, connect the MCP server to your AI assistant.\n');

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
          console.log('  • "Analyze the features and give them better names and descriptions"');
          console.log('  • "What features does this project have?"');
          console.log('  • "Explain the architecture based on the feature map"');
          console.log('\nThe AI will use these MCP tools:');
          console.log('  • get_current_features — current feature list');
          console.log('  • update_feature — update names/descriptions');

          const mcpServerPath = path.resolve(projectRoot, 'packages', 'mcp-server', 'dist', 'index.js');
          const mcpServerExists = fs.existsSync(mcpServerPath);
          if (mcpServerExists) {
            console.log(`\nMCP server location: ${mcpServerPath}`);
          } else {
            console.log('\n⚠️  MCP server not built. Run: npm run build --workspace=@featuremap/mcp-server');
          }
        }

      } catch (error) {
        console.error('❌ Scan failed:', error);
        process.exit(1);
      }
    });

  return command;
}

function saveFeatures(featuremapDir: string, clusters: Cluster[]): number {
  const featuresDir = path.join(featuremapDir, 'features');

  if (!fs.existsSync(featuresDir)) {
    fs.mkdirSync(featuresDir, { recursive: true });
  }

  let created = 0;

  for (const cluster of clusters) {
    const featureFile = path.join(featuresDir, `${cluster.id}.yaml`);
    const isNewFeature = !fs.existsSync(featureFile);
    const existing = isNewFeature ? null : loadYAML(featureFile, FeatureSchema);

    if (existing && (existing.source === 'user' || existing.source === 'ai')) {
      const updatedFeature = buildAuthoredFeature(existing, cluster);

      if (!areFeaturesEquivalent(existing, updatedFeature)) {
        updatedFeature.metadata = buildUpdatedMetadata(existing.metadata);
        saveYAML(featureFile, updatedFeature, FeatureSchema, {
          sortArrayFields: ['files', 'clusters', 'dependsOn'],
        });
      }
      continue;
    }

    const autoFeature = buildAutoFeature(cluster);

    if (existing && areFeaturesEquivalent(existing, autoFeature)) {
      continue;
    }

    autoFeature.metadata = buildUpdatedMetadata(existing?.metadata);
    saveYAML(featureFile, autoFeature, FeatureSchema, {
      sortArrayFields: ['files', 'clusters', 'dependsOn'],
    });

    if (isNewFeature) {
      created++;
    }
  }

  return created;
}

function getExportsForCluster(cluster: Cluster): string[] {
  return [];
}

function buildAuthoredFeature(existing: Feature, cluster: Cluster): Feature {
  return {
    ...existing,
    files: cluster.files.map(f => ({ path: f })),
    dependsOn: cluster.externalDependencies,
  };
}

function buildAutoFeature(cluster: Cluster): Feature {
  return {
    id: cluster.id,
    name: cluster.name,
    description: null,
    source: 'auto',
    status: 'active',
    files: cluster.files.map(f => ({ path: f })),
    exports: getExportsForCluster(cluster),
    dependsOn: cluster.externalDependencies,
  };
}

function buildGraphData(
  nodes: Graph['nodes'],
  edges: Graph['edges']
): Graph {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
  };
}

function saveGraphYaml(featuremapDir: string, clusters: Cluster[]): void {
  const nodes = clusters.map(cluster => ({
    id: cluster.id,
    label: cluster.name,
    type: 'feature',
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
    const existing = loadYAML(filePath, GraphSchema);
    const nextGraph = buildGraphData(nodes, edges);

    if (areGraphsEquivalent(existing, nextGraph)) {
      return;
    }
  }

  const graphYaml = buildGraphData(nodes, edges);
  saveYAML(filePath, graphYaml, GraphSchema, {
    sortArrayFields: ['nodes', 'edges'],
  });
}
