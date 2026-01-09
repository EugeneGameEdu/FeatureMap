import * as fs from 'fs';
import * as path from 'path';

const LEGACY_FOLDER_TOKENS = ['old', 'legacy', 'deprecated', 'backup', 'archive'];
const LEGACY_AGE_DAYS = 720;

export function detectLegacyNote(partPath: string, projectRoot: string): string | null {
  const folderName = path.posix.basename(partPath).toLowerCase();
  if (LEGACY_FOLDER_TOKENS.some((token) => folderName.includes(token))) {
    return 'Looks like legacy code';
  }

  const partAbsolute = partPath === '.' ? projectRoot : path.join(projectRoot, partPath);
  if (isLikelyStale(partAbsolute)) {
    return 'Looks like legacy code';
  }

  return detectLegacyReact(partAbsolute);
}

function detectLegacyReact(partAbsolute: string): string | null {
  const packageJsonPath = path.join(partAbsolute, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const parsed = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const version = parsed.dependencies?.react ?? parsed.devDependencies?.react;
    const major = version ? parseMajorVersion(version) : null;
    if (major !== null && major < 16) {
      return 'React < 16 (legacy)';
    }
  } catch {
    return null;
  }

  return null;
}

function parseMajorVersion(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) {
    return null;
  }
  const major = Number.parseInt(match[0], 10);
  return Number.isNaN(major) ? null : major;
}

function isLikelyStale(partAbsolute: string): boolean {
  try {
    const stats = fs.statSync(partAbsolute);
    const ageMs = Date.now() - stats.mtime.getTime();
    return ageMs > LEGACY_AGE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
