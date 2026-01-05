import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { Config, ConfigSchema } from '../types/config.js';
import { loadYAML } from '../utils/yaml-loader.js';

export interface ScanResult {
  config: Config;
  files: string[];
  projectRoot: string;
}

export function loadConfig(configPath: string): Config {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }

  return loadYAML(configPath, ConfigSchema, { fileType: 'config' });
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
