import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { scanProject } from '../analyzer/scanner.js';
import { buildGraph, getGraphStats, DependencyGraph } from '../analyzer/graph.js';
import { groupByFolders, Cluster } from '../analyzer/grouper.js';
import { Feature, FeatureSchema, Graph, GraphSchema, RawGraph, RawGraphSchema } from '../types/index.js';
import { loadYAML, saveYAML } from '../utils/yaml-loader.js';

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

        saveRawGraph(featuremapDir, graph);
        console.log('  ✓ Saved raw-graph.yaml');

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
          console.log('  • get_project_structure — raw dependency graph');
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

function saveRawGraph(featuremapDir: string, graph: DependencyGraph): void {
  const rawGraph: RawGraph = {
    version: 1,
    generatedAt: new Date().toISOString(),
    files: graph.files,
    dependencies: graph.dependencies,
  };

  const filePath = path.join(featuremapDir, 'raw-graph.yaml');
  saveYAML(filePath, rawGraph, RawGraphSchema);
}

function saveFeatures(featuremapDir: string, clusters: Cluster[]): number {
  const featuresDir = path.join(featuremapDir, 'features');

  if (!fs.existsSync(featuresDir)) {
    fs.mkdirSync(featuresDir, { recursive: true });
  }

  let created = 0;

  for (const cluster of clusters) {
    const featureFile = path.join(featuresDir, `${cluster.id}.yaml`);

    if (fs.existsSync(featureFile)) {
      const existing = loadYAML(featureFile, FeatureSchema);
      if (existing.source === 'user' || existing.source === 'ai') {
        existing.files = cluster.files.map(f => ({ path: f }));
        existing.dependsOn = cluster.externalDependencies;
        if (!existing.metadata) {
          existing.metadata = {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        } else {
          existing.metadata.updatedAt = new Date().toISOString();
        }
        saveYAML(featureFile, existing, FeatureSchema);
        continue;
      }
    }

    const feature: Feature = {
      id: cluster.id,
      name: cluster.name,
      description: null,
      source: 'auto',
      status: 'active',
      files: cluster.files.map(f => ({ path: f })),
      exports: getExportsForCluster(cluster),
      dependsOn: cluster.externalDependencies,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    saveYAML(featureFile, feature, FeatureSchema);
    created++;
  }

  return created;
}

function getExportsForCluster(cluster: Cluster): string[] {
  return [];
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

  const graphYaml: Graph = {
    version: 1,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
  };

  const filePath = path.join(featuremapDir, 'graph.yaml');
  saveYAML(filePath, graphYaml, GraphSchema);
}
