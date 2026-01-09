import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as yaml from 'yaml';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { type Config, type Layout, LayoutSchema } from '../types/index.js';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import { saveYAML } from '../utils/yaml-loader.js';
import {
  formatStructureForAI,
  scanProjectStructure,
  type FolderInfo,
  type ProjectStructure,
} from '../analyzer/structure-scanner.js';

const DEFAULT_EXCLUDES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/vendor/**',
  '**/*.test.{ts,tsx,js,jsx}',
  '**/*.spec.{ts,tsx,js,jsx}',
  '**/*.d.ts',
  '**/*_test.go',
  '**/testdata/**',
];

const DEFAULT_CONFIG_TEMPLATE = `version: ${SUPPORTED_VERSIONS.config}
project:
  name: "my-project"
  root: "."

scan:
  # Add patterns for files to scan. Examples:
  # TypeScript:  "src/**/*.{ts,tsx}"
  # JavaScript:  "src/**/*.{js,jsx}"
  # Go:          "**/*.go"
  # Monorepo:    "packages/*/src/**/*.{ts,tsx}"
  include: []

  exclude:
    - "**/node_modules/**"
    - "**/dist/**"
    - "**/build/**"
    - "**/vendor/**"
    - "**/*.test.{ts,tsx,js,jsx}"
    - "**/*.spec.{ts,tsx,js,jsx}"
    - "**/*.d.ts"
    - "**/*_test.go"
    - "**/testdata/**"

features:
  hints: []
`;

const MCP_TIMEOUT_MS = 3000;

export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Initialize FeatureMap in current project')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
      const projectRoot = process.cwd();
      const featuremapDir = path.join(projectRoot, '.featuremap');
      const configPath = path.join(featuremapDir, 'config.yaml');
      const suggestedConfigPath = path.join(featuremapDir, 'config.yaml.suggested');
      const clustersDir = path.join(featuremapDir, 'clusters');
      const featuresDir = path.join(featuremapDir, 'features');
      const commentsDir = path.join(featuremapDir, 'comments');
      const contextDir = path.join(featuremapDir, 'context');
      const decisionsPath = path.join(contextDir, 'decisions.yaml');
      const constraintsPath = path.join(contextDir, 'constraints.yaml');
      const layoutPath = path.join(featuremapDir, 'layout.yaml');
      const structurePath = path.join(featuremapDir, 'structure.txt');

      if (fs.existsSync(featuremapDir) && !options.force) {
        console.log('Already initialized. Run "featuremap scan" or edit config.yaml.');
        return;
      }

      ensureDirectory(featuremapDir, '.featuremap/');
      ensureDirectory(clustersDir, '.featuremap/clusters/');
      ensureDirectory(featuresDir, '.featuremap/features/');
      ensureDirectory(commentsDir, '.featuremap/comments/');
      ensureDirectory(contextDir, '.featuremap/context/');

      console.log('Analyzing project structure...\n');
      const structure = await scanProjectStructure(projectRoot);
      const structureText = formatStructureForAI(structure);
      const summaryLines = buildStructureSummary(structure);

      console.log('Found:');
      if (summaryLines.length === 0) {
        console.log('  (no folders detected)');
      } else {
        for (const line of summaryLines) {
          console.log(`  ${line}`);
        }
      }
      console.log('\nGenerating configuration with AI...\n');

      const mcpResult = await tryCallAnalyzeProjectStructure(projectRoot);
      let configStatus: 'ai' | 'fallback' | 'suggested' = 'fallback';

      if (mcpResult) {
        const suggestedConfig = buildSuggestedConfig(structure, projectRoot);
        const configYaml = formatConfigYaml(suggestedConfig);

        console.log('AI-generated configuration:\n');
        console.log(configYaml);

        const shouldSave = await promptYesNo('Save this configuration? [Y/n] ', true);
        if (shouldSave) {
          fs.writeFileSync(configPath, configYaml, 'utf-8');
          console.log(`OK Created ${path.relative(projectRoot, configPath)}`);
          configStatus = 'ai';
        } else {
          fs.writeFileSync(suggestedConfigPath, configYaml, 'utf-8');
          fs.writeFileSync(configPath, DEFAULT_CONFIG_TEMPLATE, 'utf-8');
          console.log(`Saved suggested config to ${path.relative(projectRoot, suggestedConfigPath)}`);
          console.log(`OK Created ${path.relative(projectRoot, configPath)}`);
          configStatus = 'suggested';
        }
      } else {
        fs.writeFileSync(configPath, DEFAULT_CONFIG_TEMPLATE, 'utf-8');
        fs.writeFileSync(structurePath, structureText, 'utf-8');

        console.log('AI configuration not available (MCP server not connected).\n');
        console.log('Created .featuremap/ with empty configuration.\n');
        console.log('To complete setup:');
        console.log('  1. Connect to MCP server (Cursor, Claude Desktop, etc.)');
        console.log('  2. Ask AI: "Analyze my project structure and generate featuremap config"');
        console.log('  3. Or manually edit .featuremap/config.yaml');
        console.log('');
        console.log(`Your project structure has been saved to ${path.relative(projectRoot, structurePath)}.`);
        configStatus = 'fallback';
      }

      if (!fs.existsSync(layoutPath)) {
        const layout: Layout = {
          version: SUPPORTED_VERSIONS.layout,
          positions: {},
          metadata: {
            updatedAt: new Date().toISOString(),
          },
        };
        saveYAML(layoutPath, layout, LayoutSchema);
        console.log('OK Created .featuremap/layout.yaml');
      }

      const decisionsTemplate =
        'version: 1\nsource: manual\nupdatedAt: "2024-01-01T00:00:00Z"\n\n' +
        'decisions:\n' +
        '  # Example - uncomment and edit:\n' +
        '  # - id: use-react\n' +
        '  #   title: "Use React for frontend"\n' +
        '  #   description: "Chose React as the primary frontend framework"\n' +
        '  #   rationale: "Team expertise, ecosystem, hiring pool"\n' +
        '  #   date: "2024-01-01"\n' +
        '  #   status: active\n' +
        '  []\n';

      const constraintsTemplate =
        'version: 1\nsource: manual\nupdatedAt: "2024-01-01T00:00:00Z"\n\n' +
        'constraints:\n' +
        '  # Example - uncomment and edit:\n' +
        '  # - id: avoid-ssr\n' +
        '  #   type: technical\n' +
        '  #   title: "Client-only rendering"\n' +
        '  #   description: "The app must run without server-side rendering"\n' +
        '  #   impact: "All pages must be compatible with static hosting"\n' +
        '  []\n';

      writeTemplateFile(decisionsPath, decisionsTemplate, '.featuremap/context/decisions.yaml');
      writeTemplateFile(constraintsPath, constraintsTemplate, '.featuremap/context/constraints.yaml');

      updateGitignore(projectRoot);

      console.log('\nFeatureMap initialized! Next steps:');
      if (configStatus === 'fallback') {
        console.log('  1. Edit .featuremap/config.yaml');
        console.log('  2. Run: featuremap scan');
      } else if (configStatus === 'suggested') {
        console.log('  1. Review .featuremap/config.yaml.suggested');
        console.log('  2. Update .featuremap/config.yaml as needed');
        console.log('  3. Run: featuremap scan');
      } else {
        console.log('  1. Run: featuremap scan');
      }
    });

  return command;
}

function ensureDirectory(dirPath: string, label: string): void {
  if (fs.existsSync(dirPath)) {
    return;
  }

  fs.mkdirSync(dirPath, { recursive: true });
  console.log(`OK Created ${label}`);
}

function writeTemplateFile(filePath: string, content: string, label: string): void {
  if (fs.existsSync(filePath)) {
    return;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`OK Created ${label}`);
}

function updateGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const gitignoreEntry = '\n# FeatureMap cache\n.featuremap/raw-graph.yaml\n';

  if (!fs.existsSync(gitignorePath)) {
    return;
  }

  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  if (gitignoreContent.includes('.featuremap/raw-graph.yaml')) {
    return;
  }

  fs.appendFileSync(gitignorePath, gitignoreEntry);
  console.log('OK Updated .gitignore');
}

function buildStructureSummary(structure: ProjectStructure): string[] {
  const folders = structure.folders
    .filter((folder) => folder.depth === 1)
    .sort((a, b) => a.path.localeCompare(b.path));

  return folders.map((folder) => formatFolderSummary(folder));
}

function formatFolderSummary(folder: FolderInfo): string {
  const normalizedPath = folder.path.replace(/\\/g, '/');
  const markers = folder.markers;
  const markerLabel = markers.length > 0 ? ` (${markers.join(', ')})` : '';

  const counts = getExtensionCounts(folder.extensions);
  const markersLower = markers.map((marker) => marker.toLowerCase());
  const hasGo = counts.go > 0 || markersLower.includes('go.mod');
  const hasFrontendMarkers = markersLower.some((marker) =>
    ['package.json', 'tsconfig.json', 'next.config.', 'vite.config.', 'nuxt.config.', 'astro.config.'].some(
      (prefix) => marker.startsWith(prefix)
    )
  );
  const hasJsTs = counts.ts + counts.tsx + counts.js + counts.jsx > 0 || hasFrontendMarkers;
  const hasScripts = counts.py + counts.sh + counts.ps1 + counts.bat > 0;

  let label = 'Other';
  if (hasGo) {
    label = 'Go project';
  } else if (hasJsTs) {
    label = counts.tsx > 0 ? 'TypeScript/React' : 'TypeScript/JavaScript';
  } else if (hasScripts) {
    label = 'Shell/Python';
  }

  let countLabel = `~${folder.fileCount} files`;
  let supportedSuffix = ' (not supported)';

  if (hasGo) {
    countLabel = `~${counts.go} .go files`;
    supportedSuffix = '';
  } else if (hasJsTs) {
    const tsCount = counts.ts + counts.tsx;
    const jsCount = counts.js + counts.jsx;
    const total = tsCount + jsCount;
    const extLabel = tsCount > 0 ? '.ts/.tsx' : '.js/.jsx';
    countLabel = `~${total} ${extLabel} files`;
    supportedSuffix = '';
  }

  return `${normalizedPath}/ - ${label}${markerLabel}, ${countLabel}${supportedSuffix}`;
}

function getExtensionCounts(extensions: Record<string, number>): {
  ts: number;
  tsx: number;
  js: number;
  jsx: number;
  go: number;
  py: number;
  sh: number;
  ps1: number;
  bat: number;
} {
  return {
    ts: extensions['.ts'] ?? 0,
    tsx: extensions['.tsx'] ?? 0,
    js: extensions['.js'] ?? 0,
    jsx: extensions['.jsx'] ?? 0,
    go: extensions['.go'] ?? 0,
    py: extensions['.py'] ?? 0,
    sh: extensions['.sh'] ?? 0,
    ps1: extensions['.ps1'] ?? 0,
    bat: extensions['.bat'] ?? 0,
  };
}

function buildSuggestedConfig(structure: ProjectStructure, projectRoot: string): Config {
  const include = deriveIncludePatterns(structure);
  return {
    version: SUPPORTED_VERSIONS.config,
    project: {
      name: path.basename(projectRoot),
      root: '.',
    },
    scan: {
      include,
      exclude: [...DEFAULT_EXCLUDES],
    },
    features: {
      hints: [],
    },
  };
}

function deriveIncludePatterns(structure: ProjectStructure): string[] {
  const includes = new Set<string>();
  const folders = new Map(structure.folders.map((folder) => [folder.path, folder]));
  const rootFolder = folders.get('.') ?? null;

  const srcFolder = folders.get('src');
  if (srcFolder && hasSupportedJsTs(srcFolder.extensions)) {
    includes.add('src/**/*.{ts,tsx,js,jsx}');
  }

  const hasPackagesSrc = structure.folders.some((folder) =>
    /^packages\/[^/]+\/src$/.test(folder.path) && hasSupportedJsTs(folder.extensions)
  );
  if (hasPackagesSrc) {
    includes.add('packages/*/src/**/*.{ts,tsx,js,jsx}');
  }

  const hasAppsSrc = structure.folders.some((folder) =>
    /^apps\/[^/]+\/src$/.test(folder.path) && hasSupportedJsTs(folder.extensions)
  );
  if (hasAppsSrc) {
    includes.add('apps/*/src/**/*.{ts,tsx,js,jsx}');
  }

  if (includes.size === 0) {
    const topLevelFolders = structure.folders.filter((folder) => folder.depth === 1);
    for (const folder of topLevelFolders) {
      if (hasSupportedJsTs(folder.extensions)) {
        includes.add(`${folder.path}/**/*.{ts,tsx,js,jsx}`);
      }
    }
  }

  if (includes.size === 0 && rootFolder && hasSupportedJsTs(rootFolder.extensions)) {
    includes.add('**/*.{ts,tsx,js,jsx}');
  }

  const goCount = rootFolder?.extensions['.go'] ?? 0;
  if (goCount > 0) {
    includes.add('**/*.go');
  }

  return [...includes].sort((a, b) => a.localeCompare(b));
}

function hasSupportedJsTs(extensions: Record<string, number>): boolean {
  return (
    (extensions['.ts'] ?? 0) > 0 ||
    (extensions['.tsx'] ?? 0) > 0 ||
    (extensions['.js'] ?? 0) > 0 ||
    (extensions['.jsx'] ?? 0) > 0
  );
}

function formatConfigYaml(config: Config): string {
  return yaml.stringify(config, { indent: 2 }).trimEnd();
}

async function promptYesNo(question: string, defaultYes: boolean): Promise<boolean> {
  const answer = await askQuestion(question);
  if (!answer) {
    return defaultYes;
  }

  const normalized = answer.toLowerCase();
  if (normalized === 'y' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'n' || normalized === 'no') {
    return false;
  }

  return defaultYes;
}

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function tryCallAnalyzeProjectStructure(projectRoot: string): Promise<string | null> {
  const serverPath = path.resolve(projectRoot, 'packages', 'mcp-server', 'dist', 'index.js');
  if (!fs.existsSync(serverPath)) {
    return null;
  }

  const client = new Client({ name: 'featuremap-cli', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    cwd: projectRoot,
    stderr: 'pipe',
  });

  try {
    const callPromise = (async () => {
      await client.connect(transport);
      return await client.callTool({
        name: 'analyze_project_structure',
        arguments: { projectRoot },
      });
    })().catch(() => null);

    const result = await withTimeout(callPromise, MCP_TIMEOUT_MS);

    if (!result || result.isError) {
      return null;
    }

    const content = Array.isArray(result.content) ? result.content : [];
    const textEntry = content.find(
      (entry) => entry.type === 'text' && typeof entry.text === 'string'
    );
    return textEntry?.text ?? null;
  } catch {
    return null;
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });

  const result = await Promise.race([promise, timeoutPromise]);
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  return result;
}
