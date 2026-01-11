import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { stringify } from 'yaml';
import { z } from 'zod';
import {
  buildContextTemplates,
  SUPPORTED_VERSIONS,
  writeYamlTemplate,
} from '@featuremap/cli/dist/api.js';

export const saveProjectConfigTool = {
  name: 'save_project_config',
  description: `Save FeatureMap configuration and create .featuremap/ directory structure.

WHEN TO USE:
- After setup_featuremap identified project parts
- User has chosen which folders to scan
- Before calling run_scan

WHAT IT DOES:
- Creates .featuremap/ directory if not exists
- Creates subdirectories: clusters/, features/, groups/, context/, comments/
- Generates config.yaml with include/exclude patterns based on chosen folders
- Does NOT run the scan - call run_scan after this

PARAMETERS:
- projectName: Name for the project (shown in UI)
- includePaths: Array of folder paths to scan, e.g. ["backend/", "frontend/src/"]
- excludePatterns: Optional additional exclude patterns

EXAMPLE USAGE:
After user says "scan backend and frontend":
save_project_config({
  projectName: "MyProject",
  includePaths: ["backend/", "frontend/"],
})

This will generate config with patterns like:
- "backend/**/*.go"
- "frontend/**/*.{ts,tsx,js,jsx}"`,
  parameters: {
    projectName: z.string().describe('Project name for display'),
    includePaths: z.array(z.string()).describe('Folder paths to include in scan'),
    excludePatterns: z
      .array(z.string())
      .optional()
      .describe('Additional exclude patterns beyond defaults'),
    projectRoot: z.string().optional().describe('Project root, defaults to cwd'),
  },
  execute: async (params: {
    projectName: string;
    includePaths: string[];
    excludePatterns?: string[];
    projectRoot?: string;
  }) => {
    const projectRoot = params.projectRoot ? resolve(params.projectRoot) : process.cwd();
    const featuremapDir = join(projectRoot, '.featuremap');

    const dirs = ['clusters', 'features', 'groups', 'context', 'comments'];
    ensureDirectory(featuremapDir);
    for (const dir of dirs) {
      ensureDirectory(join(featuremapDir, dir));
    }

    const includePatterns = generateIncludePatterns(params.includePaths);
    const config = {
      version: SUPPORTED_VERSIONS.config,
      project: {
        name: params.projectName,
        root: '.',
      },
      scan: {
        include: includePatterns,
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/vendor/**',
          '**/*.test.{ts,tsx,js,jsx}',
          '**/*.spec.{ts,tsx,js,jsx}',
          '**/*.d.ts',
          '**/*_test.go',
          '**/testdata/**',
          ...(params.excludePatterns || []),
        ],
      },
      features: {
        hints: [],
      },
    };

    const configPath = join(featuremapDir, 'config.yaml');
    const configYaml = `${stringify(config, { indent: 2, lineWidth: 0 }).trimEnd()}\n`;
    writeFileSync(configPath, configYaml, 'utf-8');

    createContextTemplates(join(featuremapDir, 'context'));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              success: true,
              message: 'Configuration saved successfully.',
              configPath,
              createdDirectories: dirs.map((dir) => `.featuremap/${dir}/`),
              config: {
                projectName: config.project.name,
                includePatterns: config.scan.include,
                excludePatterns: config.scan.exclude,
              },
              nextStep: {
                action: 'Run technical scan',
                call: 'run_scan',
              },
            },
            null,
            2
          ),
        },
      ],
    };
  },
};

function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeIncludePath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.replace(/\\/g, '/').replace(/\/+$/, '');
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  return normalized.length === 0 ? '.' : normalized;
}

function generateIncludePatterns(paths: string[]): string[] {
  const patterns: string[] = [];

  for (const raw of paths) {
    const normalized = normalizeIncludePath(raw);
    if (!normalized) {
      continue;
    }

    const prefix = normalized === '.' ? '' : `${normalized}/`;
    patterns.push(`${prefix}**/*.{ts,tsx}`);
    patterns.push(`${prefix}**/*.{js,jsx}`);
    patterns.push(`${prefix}**/*.go`);
  }

  return [...new Set(patterns)].sort((a, b) => a.localeCompare(b));
}

function createContextTemplates(contextDir: string): void {
  const now = new Date().toISOString();
  const templates = buildContextTemplates(now);

  for (const template of templates) {
    const filePath = join(contextDir, template.filename);
    if (existsSync(filePath)) {
      continue;
    }
    writeYamlTemplate(filePath, template.content);
  }
}
