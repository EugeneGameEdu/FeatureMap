import * as fs from 'fs';
import * as path from 'path';
import type { ProjectStructure } from '@featuremap/cli/dist/analyzer/structure-scanner.js';
import { detectLegacyNote } from './setupFeaturemapLegacy.js';
import { detectMarkerNotes } from './setupFeaturemapMarkers.js';

export type ProjectPartType = 'typescript' | 'javascript' | 'go' | 'python' | 'rust' | 'other';

export interface ProjectPart {
  path: string;
  type: ProjectPartType;
  fileCount: number;
  canParse: boolean;
  note: string | null;
  markers: string[];
}

export interface SetupAnalysis {
  parts: ProjectPart[];
  totalFiles: number;
  supportedFiles: number;
  unsupportedFiles: number;
}

const JS_EXTENSIONS = new Set(['.js', '.jsx']);
const TS_EXTENSIONS = new Set(['.ts', '.tsx']);
const CONTAINER_FOLDERS = new Set(['packages', 'apps', 'services', 'modules', 'projects']);

export function analyzeStructureForSetup(
  structure: ProjectStructure,
  projectRoot: string
): SetupAnalysis {
  const foldersByPath = new Map(
    structure.folders.map((folder) => [normalizeFolderPath(folder.path), folder])
  );
  const rootFolder = foldersByPath.get('.');
  const rootExtensions = rootFolder?.extensions ?? {};

  const partRoots = selectPartRoots(structure.folders);
  const parts = partRoots
    .map((partPath) => buildProjectPart(partPath, foldersByPath, projectRoot))
    .filter((part): part is ProjectPart => Boolean(part));

  const supportedFiles = countSupportedFiles(rootExtensions);
  const unsupportedFiles = Math.max(0, structure.totalFiles - supportedFiles);

  return {
    parts,
    totalFiles: structure.totalFiles,
    supportedFiles,
    unsupportedFiles,
  };
}

function selectPartRoots(folders: ProjectStructure['folders']): string[] {
  const topLevel = folders.filter((folder) => folder.depth === 1);
  if (topLevel.length === 0) {
    return ['.'];
  }

  const roots: string[] = [];
  for (const folder of topLevel) {
    const name = path.posix.basename(folder.path);
    if (CONTAINER_FOLDERS.has(name)) {
      const children = folders.filter(
        (candidate) => getParentPath(candidate.path) === folder.path
      );
      if (children.length > 0) {
        roots.push(...children.map((child) => child.path));
        continue;
      }
    }
    roots.push(folder.path);
  }

  return Array.from(new Set(roots.map(normalizeFolderPath))).sort((a, b) => a.localeCompare(b));
}

function buildProjectPart(
  partPath: string,
  foldersByPath: Map<string, ProjectStructure['folders'][number]>,
  projectRoot: string
): ProjectPart | null {
  const normalizedPath = normalizeFolderPath(partPath);
  const folder = foldersByPath.get(normalizedPath);
  if (!folder) {
    return null;
  }

  const extensions = folder.extensions ?? {};
  const markers = collectMarkersForPath(normalizedPath, foldersByPath);
  const type = detectPartType(extensions);
  const canParse = canParsePart(extensions);
  const note = buildPartNote({
    path: normalizedPath,
    type,
    markers,
    projectRoot,
  });

  return {
    path: normalizedPath === '.' ? './' : `${normalizedPath}/`,
    type,
    fileCount: folder.fileCount,
    canParse,
    note,
    markers,
  };
}

function detectPartType(extensions: Record<string, number>): ProjectPartType {
  if (countExtensions(extensions, TS_EXTENSIONS) > 0) {
    return 'typescript';
  }
  if (countExtensions(extensions, JS_EXTENSIONS) > 0) {
    return 'javascript';
  }
  if ((extensions['.go'] ?? 0) > 0) {
    return 'go';
  }
  if ((extensions['.py'] ?? 0) > 0) {
    return 'python';
  }
  if ((extensions['.rs'] ?? 0) > 0) {
    return 'rust';
  }
  return 'other';
}

function canParsePart(
  extensions: Record<string, number>
): boolean {
  if (countExtensions(extensions, TS_EXTENSIONS) + countExtensions(extensions, JS_EXTENSIONS) > 0) {
    return true;
  }

  return (extensions['.go'] ?? 0) > 0;
}

function buildPartNote(input: {
  path: string;
  type: ProjectPartType;
  markers: string[];
  projectRoot: string;
}): string | null {
  const notes: string[] = [];
  const markerSet = new Set(input.markers.map((marker) => marker.toLowerCase()));
  notes.push(...detectMarkerNotes(markerSet));

  const legacyNote = detectLegacyNote(input.path, input.projectRoot);
  if (legacyNote) {
    notes.push(legacyNote);
  }

  if (hasRequirementsFile(input.path, input.projectRoot)) {
    notes.push('Python project (not supported)');
  }

  if (input.type === 'python' && !notes.some((note) => note.includes('Python'))) {
    notes.push('Python project (not supported)');
  }
  if (input.type === 'rust' && !notes.some((note) => note.includes('Rust'))) {
    notes.push('Rust project (not supported)');
  }

  return notes.length > 0 ? Array.from(new Set(notes)).join('; ') : null;
}

function hasRequirementsFile(partPath: string, projectRoot: string): boolean {
  const partAbsolute = partPath === '.' ? projectRoot : path.join(projectRoot, partPath);
  return fs.existsSync(path.join(partAbsolute, 'requirements.txt'));
}

function collectMarkersForPath(
  partPath: string,
  foldersByPath: Map<string, ProjectStructure['folders'][number]>
): string[] {
  const prefix = partPath === '.' ? '' : `${partPath}/`;
  const markers = new Set<string>();

  for (const [folderPath, folder] of foldersByPath.entries()) {
    const isRoot = partPath === '.' && folderPath === '.';
    const isChild =
      partPath !== '.' && (folderPath === partPath || folderPath.startsWith(prefix));
    if (!isRoot && !isChild) {
      continue;
    }
    for (const marker of folder.markers) {
      markers.add(marker);
    }
  }

  return Array.from(markers).sort((a, b) => a.localeCompare(b));
}

function countSupportedFiles(extensions: Record<string, number>): number {
  let total = 0;
  for (const [ext, count] of Object.entries(extensions)) {
    if (TS_EXTENSIONS.has(ext) || JS_EXTENSIONS.has(ext)) {
      total += count;
      continue;
    }
    if (ext === '.go') {
      total += count;
    }
  }
  return total;
}

function countExtensions(extensions: Record<string, number>, targets: Set<string>): number {
  let total = 0;
  for (const [ext, count] of Object.entries(extensions)) {
    if (targets.has(ext)) {
      total += count;
    }
  }
  return total;
}

function getParentPath(folderPath: string): string | null {
  if (folderPath === '.' || folderPath === '') {
    return null;
  }
  const parent = path.posix.dirname(folderPath);
  return parent === '' ? '.' : parent;
}

function normalizeFolderPath(folderPath: string): string {
  if (folderPath === '' || folderPath === '.') {
    return '.';
  }
  return folderPath.replace(/\\/g, '/').replace(/\/$/, '');
}
