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
import { scanProject } from '../analyzer/scanner.js';
import {
  ConventionsSchema,
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
import { buildContextTemplates } from '../utils/contextTemplates.js';
import { writeYamlTemplate } from '../utils/yaml-loader.js';

interface ContextSummary {
  created: string[];
  existing: string[];
  updated: string[];
  skipped: string[];
}

export function createContextCommand(): Command {
  const command = new Command('context');

  command.description('Manage project context files');

  command
    .command('init')
    .description('Initialize .featuremap/context templates and refresh auto context')
    .action(async () => {
      const projectRoot = process.cwd();
      const featuremapDir = path.join(projectRoot, '.featuremap');

      if (!fs.existsSync(featuremapDir)) {
        console.error('ERROR: .featuremap/ not found. Run "featuremap init" first.');
        process.exit(1);
      }

      const contextDir = path.join(featuremapDir, 'context');
      ensureDirectory(contextDir);

      const summary: ContextSummary = {
        created: [],
        existing: [],
        updated: [],
        skipped: [],
      };

      const now = new Date().toISOString();
      const templates = buildContextTemplates(now);
      for (const template of templates) {
        const filePath = path.join(contextDir, template.filename);
        if (fs.existsSync(filePath)) {
          summary.existing.push(template.label);
          continue;
        }
        writeYamlTemplate(filePath, template.content);
        summary.created.push(template.label);
      }

      try {
        const packageJsonPaths = findPackageJsonPaths(projectRoot);
        const goModPaths = findGoModPaths(projectRoot);
        const techStack = detectTechStack({ rootDir: projectRoot, packageJsonPaths });
        const techStackPath = path.join(contextDir, 'tech-stack.yaml');
        recordAutoWrite(summary, 'tech-stack.yaml', saveAutoContext(techStackPath, techStack, TechStackSchema));

        const structure = detectStructureContext({
          projectRoot,
          packageJsonPaths,
          goModPaths,
        });
        const structurePath = path.join(contextDir, 'structure.yaml');
        recordAutoWrite(summary, 'structure.yaml', saveAutoContext(structurePath, structure, StructureSchema));

        const testing = detectTesting({ projectRoot, packageJsonPaths });
        const testingPath = path.join(contextDir, 'testing.yaml');
        recordAutoWrite(summary, 'testing.yaml', saveAutoContext(testingPath, testing, TestingSchema));

        const scanResult = await scanProject(projectRoot);
        const graph = await buildGraph(scanResult);
        const graphStats = getGraphStats(graph);
        const grouping = groupByFolders(graph);
        const conventionsInput = buildConventionsInput(graph);
        const conventions = detectConventions(conventionsInput);
        const conventionsPath = path.join(contextDir, 'conventions.yaml');
        recordAutoWrite(
          summary,
          'conventions.yaml',
          saveAutoContext(conventionsPath, conventions, ConventionsSchema)
        );

        const statistics = detectStatistics({
          totalFiles: graphStats.totalFiles,
          totalDependencies: graphStats.totalDependencies,
          clusterCount: grouping.clusters.length,
          featureCount: countFeatureFiles(featuremapDir),
        });
        const statisticsPath = path.join(contextDir, 'statistics.yaml');
        recordAutoWrite(
          summary,
          'statistics.yaml',
          saveAutoContext(statisticsPath, statistics, StatisticsSchema)
        );
      } catch (error) {
        console.error('ERROR: Failed to refresh auto context:', error);
        process.exit(1);
      }

      printSummary(summary);
    });

  return command;
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function recordAutoWrite(summary: ContextSummary, label: string, wrote: boolean): void {
  if (wrote) {
    summary.updated.push(label);
  } else {
    summary.skipped.push(label);
  }
}

function printSummary(summary: ContextSummary): void {
  console.log('\nContext init summary:');
  if (summary.created.length > 0) {
    console.log(`  Created templates: ${summary.created.join(', ')}`);
  }
  if (summary.existing.length > 0) {
    console.log(`  Existing templates: ${summary.existing.join(', ')}`);
  }
  if (summary.updated.length > 0) {
    console.log(`  Updated auto context: ${summary.updated.join(', ')}`);
  }
  if (summary.skipped.length > 0) {
    console.log(`  Skipped auto context: ${summary.skipped.join(', ')}`);
  }

  console.log('\nEdit the manual context files in .featuremap/context/:');
  console.log('  - decisions.yaml');
  console.log('  - constraints.yaml');
  console.log('  - overview.yaml');
  console.log('  - design-system.yaml');
}
