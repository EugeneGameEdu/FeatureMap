import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { buildGraph, getGraphStats } from '../analyzer/graph.js';
import { groupByFolders } from '../analyzer/grouper.js';
import { detectStatistics } from '../analyzer/statistics-detector.js';
import { detectStructureContext } from '../analyzer/structure-detector.js';
import { detectTesting } from '../analyzer/testing-detector.js';
import { detectConventions } from '../analyzer/conventions-detector.js';
import { detectTechStack } from '../analyzer/tech-stack-detector.js';
import { detectRunCommands } from '../analyzer/run-commands-detector.js';
import { loadExistingClusters } from '../analyzer/cluster-loader.js';
import { applyClusterMatching } from '../analyzer/cluster-id-matching.js';
import { loadConfig, scanProject } from '../analyzer/scanner.js';
import { scanProjectStructure } from '../analyzer/structure-scanner.js';
import {
  ConventionsSchema,
  RunCommandsSchema,
  StatisticsSchema,
  StructureSchema,
  TestingSchema,
  TechStackSchema,
} from '../types/index.js';
import {
  buildConventionsInput,
  countFeatureFiles,
  findGoModPaths,
  findPackageJsonPaths,
  saveAutoContext,
} from '../utils/contextUtils.js';
import { saveGraphYaml } from '../utils/graphYaml.js';
import {
  ensureDirectory,
  ensureLayout,
  migrateLegacyClusters,
  printLayerSummary,
  saveClusters,
} from './scanHelpers.js';

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
        const goModPaths = findGoModPaths(projectRoot);
        const techStack = detectTechStack({
          rootDir: projectRoot,
          packageJsonPaths,
          goModPaths,
        });
        saveAutoContext(
          path.join(featuremapDir, 'context', 'tech-stack.yaml'),
          techStack,
          TechStackSchema
        );
        const structure = detectStructureContext({
          projectRoot,
          packageJsonPaths,
          goModPaths,
        });
        saveAutoContext(
          path.join(featuremapDir, 'context', 'structure.yaml'),
          structure,
          StructureSchema
        );
        const testing = detectTesting({ projectRoot, packageJsonPaths });
        saveAutoContext(
          path.join(featuremapDir, 'context', 'testing.yaml'),
          testing,
          TestingSchema
        );
        const runCommands = detectRunCommands({
          projectRoot,
          packageJsonPaths,
          goModPaths,
        });
        saveAutoContext(
          path.join(featuremapDir, 'context', 'run-commands.yaml'),
          runCommands,
          RunCommandsSchema
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

        saveGraphYaml(featuremapDir, clusters, graph);
        console.log('  OK Generated graph.yaml');

        const conventionsInput = buildConventionsInput(graph);
        const conventions = detectConventions(conventionsInput);
        saveAutoContext(
          path.join(featuremapDir, 'context', 'conventions.yaml'),
          conventions,
          ConventionsSchema
        );

        const statistics = detectStatistics({
          totalFiles: graphStats.totalFiles,
          totalDependencies: graphStats.totalDependencies,
          clusterCount: clusters.length,
          featureCount: countFeatureFiles(featuremapDir),
        });
        saveAutoContext(
          path.join(featuremapDir, 'context', 'statistics.yaml'),
          statistics,
          StatisticsSchema
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
