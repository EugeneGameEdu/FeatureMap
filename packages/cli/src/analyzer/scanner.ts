import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import fg from 'fast-glob';

export interface FeatureMapConfig {
  version: number;
  project: {
    name: string;
    root: string;
  };
  scan: {
    include: string[];
    exclude: string[];
  };
  features: {
    hints: Array<{
      pattern: string;
      type: string;
    }>;
  };
}

export interface ScanResult {
  config: FeatureMapConfig;
  files: string[];
  projectRoot: string;
}

export function loadConfig(configPath: string): FeatureMapConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.parse(content) as FeatureMapConfig;

  return config;
}

export async function scanProject(projectRoot: string): Promise<ScanResult> {
  const configPath = path.join(projectRoot, '.featuremap', 'config.yaml');
  const config = loadConfig(configPath);

  // Резолвим root относительно projectRoot
  const scanRoot = path.resolve(projectRoot, config.project.root);

  // Используем fast-glob для поиска файлов
  const files = await fg(config.scan.include, {
    cwd: scanRoot,
    ignore: config.scan.exclude,
    absolute: true,
    onlyFiles: true,
    dot: false,
  });

  // Сортируем для консистентности
  files.sort();

  return {
    config,
    files,
    projectRoot: scanRoot,
  };
}

// Утилита: получить относительный путь от корня проекта
export function getRelativePath(absolutePath: string, projectRoot: string): string {
  return path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
}
