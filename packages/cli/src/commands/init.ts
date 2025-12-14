import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

const DEFAULT_CONFIG = {
  version: 1,
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
      const featuresDir = path.join(featuremapDir, 'features');

      if (fs.existsSync(featuremapDir) && !options.force) {
        console.log('⚠️  .featuremap/ already exists. Use --force to overwrite.');
        return;
      }

      if (!fs.existsSync(featuremapDir)) {
        fs.mkdirSync(featuremapDir, { recursive: true });
        console.log('✓ Created .featuremap/');
      }

      if (!fs.existsSync(featuresDir)) {
        fs.mkdirSync(featuresDir, { recursive: true });
        console.log('✓ Created .featuremap/features/');
      }

      const configContent = yaml.stringify(DEFAULT_CONFIG);
      fs.writeFileSync(configPath, configContent, 'utf-8');
      console.log('✓ Created .featuremap/config.yaml');

      const gitignorePath = path.join(process.cwd(), '.gitignore');
      const gitignoreEntry = '\n# FeatureMap cache\n.featuremap/raw-graph.yaml\n';

      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
        if (!gitignoreContent.includes('.featuremap/raw-graph.yaml')) {
          fs.appendFileSync(gitignorePath, gitignoreEntry);
          console.log('✓ Updated .gitignore');
        }
      }

      console.log('\n🎉 FeatureMap initialized! Next steps:');
      console.log('   1. Edit .featuremap/config.yaml if needed');
      console.log('   2. Run: featuremap scan');
    });

  return command;
}
