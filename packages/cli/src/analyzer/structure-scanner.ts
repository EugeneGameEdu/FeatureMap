import * as fs from 'fs';
import * as path from 'path';

export interface FolderInfo {
  path: string;
  depth: number;
  fileCount: number;
  extensions: Record<string, number>;
  markers: string[];
}

export interface ProjectStructure {
  root: string;
  folders: FolderInfo[];
  gitignorePatterns: string[];
  totalFiles: number;
}

interface StructureScanOptions {
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 4;
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  'vendor',
  '__pycache__',
  '.featuremap',
]);

const MARKER_FILES = new Set([
  'package.json',
  'go.mod',
  'pyproject.toml',
  'cargo.toml',
  'tsconfig.json',
]);

const MARKER_PREFIXES = ['vite.config.', 'next.config.', 'nuxt.config.', 'astro.config.'];

const NO_EXTENSION_KEY = '<none>';

export async function scanProjectStructure(
  projectRoot: string,
  options: StructureScanOptions = {}
): Promise<ProjectStructure> {
  const resolvedRoot = path.resolve(projectRoot);
  const maxDepth = Math.max(0, options.maxDepth ?? DEFAULT_MAX_DEPTH);
  const gitignorePatterns = readGitignorePatterns(resolvedRoot);
  const folders: FolderInfo[] = [];

  const rootInfo = scanFolder(resolvedRoot, '', 0, maxDepth, folders);
  if (rootInfo) {
    folders.sort((a, b) => a.path.localeCompare(b.path));
  }

  return {
    root: normalizePath(resolvedRoot),
    folders,
    gitignorePatterns,
    totalFiles: rootInfo?.fileCount ?? 0,
  };
}

export function formatStructureForAI(structure: ProjectStructure): string {
  const lines: string[] = [];

  lines.push(`Project root: ${structure.root}`);
  lines.push(`Total files: ~${structure.totalFiles}`);
  lines.push('Folders:');

  const folders = [...structure.folders].sort((a, b) => a.path.localeCompare(b.path));
  for (const folder of folders) {
    const isRoot = folder.path === '.' || folder.path === '';
    const folderPath = isRoot ? '/ (root)' : `${folder.path.replace(/\\/g, '/')}/`;
    const folderLine = isRoot ? folderPath : `${folderPath} (~${folder.fileCount} files)`;
    lines.push(folderLine);

    const extensionLine = formatExtensionLine(folder.extensions);
    if (extensionLine) {
      lines.push(`Extensions: ${extensionLine}`);
    }

    if (folder.markers.length > 0) {
      lines.push(`Markers: ${folder.markers.join(', ')}`);
    }
  }

  lines.push('Gitignore patterns:');
  if (structure.gitignorePatterns.length > 0) {
    lines.push('');
    for (const pattern of structure.gitignorePatterns) {
      lines.push(pattern);
    }
  } else {
    lines.push('(none)');
  }

  return lines.join('\n');
}

function scanFolder(
  absolutePath: string,
  relativePath: string,
  depth: number,
  maxDepth: number,
  folders: FolderInfo[]
): FolderInfo | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  } catch {
    return null;
  }

  const info: FolderInfo = {
    path: relativePath === '' ? '.' : normalizePath(relativePath),
    depth,
    fileCount: 0,
    extensions: {},
    markers: [],
  };

  for (const entry of entries) {
    const name = entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) {
        continue;
      }
      if (depth >= maxDepth) {
        continue;
      }
      const childAbsolute = path.join(absolutePath, name);
      const childRelative = relativePath ? `${relativePath}/${name}` : name;
      const childInfo = scanFolder(childAbsolute, childRelative, depth + 1, maxDepth, folders);
      if (!childInfo) {
        continue;
      }
      info.fileCount += childInfo.fileCount;
      mergeExtensionCounts(info.extensions, childInfo.extensions);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    info.fileCount += 1;

    const ext = path.extname(name).toLowerCase();
    const extensionKey = ext === '' ? NO_EXTENSION_KEY : ext;
    info.extensions[extensionKey] = (info.extensions[extensionKey] ?? 0) + 1;

    if (isMarkerFile(name)) {
      info.markers.push(name);
    }
  }

  info.markers.sort((a, b) => a.localeCompare(b));
  folders.push(info);
  return info;
}

function readGitignorePatterns(projectRoot: string): string[] {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  } catch {
    return [];
  }
}

function isMarkerFile(fileName: string): boolean {
  const normalized = fileName.toLowerCase();
  if (MARKER_FILES.has(normalized)) {
    return true;
  }
  return MARKER_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function mergeExtensionCounts(
  target: Record<string, number>,
  source: Record<string, number>
): void {
  for (const [ext, count] of Object.entries(source)) {
    target[ext] = (target[ext] ?? 0) + count;
  }
}

function formatExtensionLine(extensions: Record<string, number>): string | null {
  const entries = Object.entries(extensions).filter(([ext]) => ext.startsWith('.'));
  if (entries.length === 0) {
    return null;
  }

  entries.sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])));
  return entries.map(([ext, count]) => `${ext} (${count})`).join(', ');
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}
