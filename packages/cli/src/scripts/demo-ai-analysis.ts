/**
 * Demo script that simulates AI analysis by updating features
 * with better names and descriptions.
 *
 * Run: npx ts-node src/scripts/demo-ai-analysis.ts
 * Or after build: node dist/scripts/demo-ai-analysis.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { FeatureSchema, GraphSchema } from '../types/index.js';
import { loadYAML, saveYAML } from '../utils/yaml-loader.js';

const DEMO_UPDATES: Record<string, { name: string; description: string }> = {
  'cli-analyzer': {
    name: 'Code Analyzer',
    description:
      'Core analysis engine that parses TypeScript files, builds dependency graphs, and groups files into feature clusters using ts-morph.',
  },
  'cli-commands': {
    name: 'CLI Commands',
    description:
      'Command-line interface with init, scan, and web commands. Entry point for all FeatureMap operations.',
  },
  'cli-core': {
    name: 'CLI Entry Point',
    description: 'Main entry point that registers all CLI commands using Commander.js.',
  },
  'mcp-server-core': {
    name: 'MCP Server',
    description:
      'Model Context Protocol server that exposes FeatureMap tools to AI assistants like Cursor and Claude.',
  },
  'mcp-server-tools': {
    name: 'MCP Tools',
    description:
      'AI-accessible tools for reading project structure, getting features, and updating feature metadata.',
  },
  'web-components': {
    name: 'Map Components',
    description:
      'React Flow based interactive map with custom feature nodes and dependency visualization.',
  },
  'web-components-ui': {
    name: 'UI Components',
    description:
      'Reusable UI components from shadcn/ui including buttons, cards, badges, and the sidebar panel.',
  },
  'web-core': {
    name: 'Web Application',
    description:
      'Main React application that loads feature data and renders the interactive map with sidebar.',
  },
  'web-lib': {
    name: 'Web Utilities',
    description:
      'Data loading utilities, TypeScript types, and helper functions for the web interface.',
  },
};

async function main() {
  const projectRoot = process.cwd();
  const featuresDir = path.join(projectRoot, '.featuremap', 'features');

  if (!fs.existsSync(featuresDir)) {
    console.error('❌ .featuremap/features/ not found. Run "featuremap scan" first.');
    process.exit(1);
  }

  console.log('🤖 Simulating AI analysis...\n');

  let updated = 0;

  for (const [id, updates] of Object.entries(DEMO_UPDATES)) {
    const featurePath = path.join(featuresDir, `${id}.yaml`);

    if (!fs.existsSync(featurePath)) {
      console.log(`  ⚠️  Skipping ${id} (not found)`);
      continue;
    }

    const feature = loadYAML(featurePath, FeatureSchema, { fileType: 'feature' });

    feature.name = updates.name;
    feature.description = updates.description;
    feature.source = 'ai';
    if (!feature.metadata) {
      feature.metadata = {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      feature.metadata.updatedAt = new Date().toISOString();
    }

    saveYAML(featurePath, feature, FeatureSchema, {
      sortArrayFields: ['files', 'clusters', 'dependsOn'],
    });
    console.log(`  ✓ Updated ${id} → "${updates.name}"`);
    updated++;
  }

  const graphPath = path.join(projectRoot, '.featuremap', 'graph.yaml');
  if (fs.existsSync(graphPath)) {
    const graph = loadYAML(graphPath, GraphSchema, { fileType: 'graph' });

    if (graph.nodes) {
      for (const node of graph.nodes) {
        if (DEMO_UPDATES[node.id]) {
          node.label = DEMO_UPDATES[node.id].name;
        }
      }
    }

    graph.generatedAt = new Date().toISOString();
    saveYAML(graphPath, graph, GraphSchema, {
      sortArrayFields: ['nodes', 'edges'],
    });
    console.log('  ✓ Updated graph.yaml labels');
  }

  console.log(`\n✨ Updated ${updated} features with AI-style names and descriptions.`);
  console.log('   Run "featuremap web" to see the changes.');
}

main().catch(console.error);
