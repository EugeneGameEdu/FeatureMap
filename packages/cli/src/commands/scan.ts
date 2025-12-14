import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { scanProject } from '../analyzer/scanner.js';
import { buildGraph, getGraphStats, DependencyGraph } from '../analyzer/graph.js';
import { groupByFolders, Cluster } from '../analyzer/grouper.js';

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
          console.log('\n🤖 AI mode: MCP server functionality will be added in Phase 5');
        }

      } catch (error) {
        console.error('❌ Scan failed:', error);
        process.exit(1);
      }
    });

  return command;
}

function saveRawGraph(featuremapDir: string, graph: DependencyGraph): void {
  const rawGraph = {
    version: 1,
    generatedAt: new Date().toISOString(),
    files: graph.files,
    dependencies: graph.dependencies,
  };

  const filePath = path.join(featuremapDir, 'raw-graph.yaml');
  fs.writeFileSync(filePath, yaml.stringify(rawGraph), 'utf-8');
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
      const existing = yaml.parse(fs.readFileSync(featureFile, 'utf-8'));
      if (existing.source === 'manual' || existing.source === 'ai') {
        existing.files = cluster.files.map(f => ({ path: f }));
        existing.dependsOn = cluster.externalDependencies;
        existing.metadata = existing.metadata || {};
        existing.metadata.updatedAt = new Date().toISOString();
        fs.writeFileSync(featureFile, yaml.stringify(existing), 'utf-8');
        continue;
      }
    }

    const feature = {
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

    fs.writeFileSync(featureFile, yaml.stringify(feature), 'utf-8');
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

  const graphYaml = {
    version: 1,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
  };

  const filePath = path.join(featuremapDir, 'graph.yaml');
  fs.writeFileSync(filePath, yaml.stringify(graphYaml), 'utf-8');
}
