import * as fs from 'fs';
import * as path from 'path';
import { findWebPackagePath } from '../utils/featuremapWebSync.js';

const DATA_DIR_NAME = 'featuremap-data';

export function syncFeaturemapDataFile(projectRoot: string, relativePath: string): void {
  const sourcePath = path.resolve(projectRoot, '.featuremap', relativePath);
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const targets = resolveDataTargets(projectRoot);
  if (targets.length === 0) {
    return;
  }

  const content = fs.readFileSync(sourcePath, 'utf-8');
  for (const targetRoot of targets) {
    const targetPath = path.join(targetRoot, relativePath);
    ensureDirectory(targetPath);
    atomicWriteFile(targetPath, content);
  }
}

function resolveDataTargets(projectRoot: string): string[] {
  const targets: string[] = [];
  const webRoot = findWebPackagePath();
  if (webRoot) {
    const publicData = path.join(webRoot, 'public', DATA_DIR_NAME);
    if (fs.existsSync(publicData)) {
      targets.push(publicData);
    }
    const distData = path.join(webRoot, 'dist', DATA_DIR_NAME);
    if (fs.existsSync(distData)) {
      targets.push(distData);
    }
  }

  const fallbackPublic = path.join(projectRoot, 'packages', 'web', 'public', DATA_DIR_NAME);
  if (fs.existsSync(fallbackPublic)) {
    targets.push(fallbackPublic);
  }

  return [...new Set(targets)];
}

function ensureDirectory(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function atomicWriteFile(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp`;

  try {
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Best-effort cleanup only.
    }
    throw error;
  }
}
