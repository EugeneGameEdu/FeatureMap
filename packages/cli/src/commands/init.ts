import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { Config, ConfigSchema, Layout, LayoutSchema } from '../types/index.js';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import { saveYAML } from '../utils/yaml-loader.js';

const DEFAULT_CONFIG: Config = {
  version: SUPPORTED_VERSIONS.config,
  project: {
    name: path.basename(process.cwd()),
    root: '.',
  },
  scan: {
    include: [
      'src/**/*.ts',
      'src/**/*.tsx',
      'packages/*/src/**/*.ts',
      'packages/*/src/**/*.tsx',
    ],
    exclude: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.d.ts',
      '**/node_modules/**',
      '**/dist/**',
    ],
  },
  features: {
    hints: [],
  },
};

export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Initialize FeatureMap in current project')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
      const featuremapDir = path.join(process.cwd(), '.featuremap');
      const configPath = path.join(featuremapDir, 'config.yaml');
      const clustersDir = path.join(featuremapDir, 'clusters');
      const featuresDir = path.join(featuremapDir, 'features');
      const contextDir = path.join(featuremapDir, 'context');
      const decisionsPath = path.join(contextDir, 'decisions.yaml');
      const constraintsPath = path.join(contextDir, 'constraints.yaml');
      const layoutPath = path.join(featuremapDir, 'layout.yaml');

      if (fs.existsSync(featuremapDir) && !options.force) {
        console.log('вљ пёЏ  .featuremap/ already exists. Use --force to overwrite.');
        return;
      }

      if (!fs.existsSync(featuremapDir)) {
        fs.mkdirSync(featuremapDir, { recursive: true });
        console.log('вњ“ Created .featuremap/');
      }

      if (!fs.existsSync(clustersDir)) {
        fs.mkdirSync(clustersDir, { recursive: true });
        console.log('вњ“ Created .featuremap/clusters/');
      }

      if (!fs.existsSync(featuresDir)) {
        fs.mkdirSync(featuresDir, { recursive: true });
        console.log('вњ“ Created .featuremap/features/');
      }

      if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
        console.log('OK Created .featuremap/context/');
      }

      saveYAML(configPath, DEFAULT_CONFIG, ConfigSchema);
      console.log('вњ“ Created .featuremap/config.yaml');

      if (!fs.existsSync(layoutPath)) {
        const layout: Layout = {
          version: SUPPORTED_VERSIONS.layout,
          positions: {},
          metadata: {
            updatedAt: new Date().toISOString(),
          },
        };
        saveYAML(layoutPath, layout, LayoutSchema);
        console.log('вњ“ Created .featuremap/layout.yaml');
      }

      const decisionsTemplate = `version: 1\nsource: manual\nupdatedAt: \"2024-01-01T00:00:00Z\"\n\ndecisions:\n  # Example - uncomment and edit:\n  # - id: use-react\n  #   title: \"Use React for frontend\"\n  #   description: \"Chose React as the primary frontend framework\"\n  #   rationale: \"Team expertise, ecosystem, hiring pool\"\n  #   date: \"2024-01-01\"\n  #   status: active\n  []\n`;

      const constraintsTemplate = `version: 1\nsource: manual\nupdatedAt: \"2024-01-01T00:00:00Z\"\n\nconstraints:\n  # Example - uncomment and edit:\n  # - id: avoid-ssr\n  #   type: technical\n  #   title: \"Client-only rendering\"\n  #   description: \"The app must run without server-side rendering\"\n  #   impact: \"All pages must be compatible with static hosting\"\n  []\n`;

      writeTemplateFile(decisionsPath, decisionsTemplate, '.featuremap/context/decisions.yaml');
      writeTemplateFile(constraintsPath, constraintsTemplate, '.featuremap/context/constraints.yaml');

      const gitignorePath = path.join(process.cwd(), '.gitignore');
      const gitignoreEntry = '\n# FeatureMap cache\n.featuremap/raw-graph.yaml\n';

      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
        if (!gitignoreContent.includes('.featuremap/raw-graph.yaml')) {
          fs.appendFileSync(gitignorePath, gitignoreEntry);
          console.log('вњ“ Updated .gitignore');
        }
      }

      console.log('\nрџЋ‰ FeatureMap initialized! Next steps:');
      console.log('   1. Edit .featuremap/config.yaml if needed');
      console.log('   2. Run: featuremap scan');
    });

  return command;
}

function writeTemplateFile(filePath: string, content: string, label: string): void {
  if (fs.existsSync(filePath)) {
    return;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`OK Created ${label}`);
}
