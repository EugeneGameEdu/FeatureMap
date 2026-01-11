import * as path from 'path';
import { parseFile } from './parser.js';
import { ScanResult, getRelativePath } from './scanner.js';
import { createAliasResolver } from './tsconfig.js';
import type { ExportSymbol, ImportList } from '../types/index.js';

export interface FileNode {
  path: string;           // РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Р№ РїСѓС‚СЊ
  exports: ExportSymbol[];
  imports: ImportList;
  linesOfCode: number;
}

export interface DependencyGraph {
  files: Record<string, FileNode>;
  dependencies: Record<string, string[]>;  // file -> [files it imports]
  dependents: Record<string, string[]>;    // file -> [files that import it]
}

export async function buildGraph(scanResult: ScanResult): Promise<DependencyGraph> {
  const { files, projectRoot } = scanResult;
  const goFiles = scanResult.goFiles ?? [];
  const goImportIndex = buildGoImportIndex(goFiles);
  const relativePaths = files.map((absolutePath) => getRelativePath(absolutePath, projectRoot));
  const aliasResolver = createAliasResolver({ projectRoot, filePaths: relativePaths });
  
  const graph: DependencyGraph = {
    files: {},
    dependencies: {},
    dependents: {},
  };

  // РЁР°Рі 1: РџР°СЂСЃРёРј РІСЃРµ С„Р°Р№Р»С‹
  const parsedFiles: Map<string, ParsedCodeFile> = new Map();
  
  for (let index = 0; index < files.length; index += 1) {
    const absolutePath = files[index];
    const relativePath = relativePaths[index] ?? getRelativePath(absolutePath, projectRoot);
    const parsed = parseFile(absolutePath, { aliasResolver });
    parsedFiles.set(relativePath, parsed);
    
    graph.files[relativePath] = {
      path: relativePath,
      exports: parsed.exports,
      imports: parsed.imports,
      linesOfCode: parsed.linesOfCode,
    };
    
    graph.dependencies[relativePath] = [];
    graph.dependents[relativePath] = [];
  }

  for (const parsed of goFiles) {
    const relativePath = normalizeFilePath(parsed.path);
    const exportSymbols = parsed.exports.map((entry) => ({
      name: entry.name,
      type: entry.type,
    }));

    parsedFiles.set(relativePath, {
      path: relativePath,
      exports: exportSymbols,
      imports: parsed.imports,
      linesOfCode: parsed.linesOfCode,
    });

    graph.files[relativePath] = {
      path: relativePath,
      exports: exportSymbols,
      imports: parsed.imports,
      linesOfCode: parsed.linesOfCode,
    };

    graph.dependencies[relativePath] = [];
    graph.dependents[relativePath] = [];
  }

  // Step 2: resolve internal imports to real file paths
  for (const [filePath, parsed] of parsedFiles) {
    const fileDir = path.posix.dirname(filePath);

    if (filePath.endsWith('.go')) {
      for (const importPath of parsed.imports.internal) {
        const resolvedPath = resolveGoImport(importPath, goImportIndex);
        if (!resolvedPath) {
          continue;
        }
        graph.dependencies[filePath].push(resolvedPath);
        if (graph.dependents[resolvedPath]) {
          graph.dependents[resolvedPath].push(filePath);
        }
      }
      continue;
    }

    for (const importPath of parsed.imports.internal) {
      const resolvedPath = resolveImport(importPath, fileDir, parsedFiles);

      if (resolvedPath) {
        // filePath ВђГєВђГёВђВџВђВ±В‘ВЏВ‘В±В‘ВЊ ВђВџВ‘ВЊ resolvedPath
        graph.dependencies[filePath].push(resolvedPath);

        // resolvedPath В‘ВЃВђВїВђВїВ‘ВЊ ВђГєВђГёВђВџВђВ±В‘ВЏВ‘В±ВђВџВђВџВђВџВђВџ filePath
        if (graph.dependents[resolvedPath]) {
          graph.dependents[resolvedPath].push(filePath);
        }
      }
    }
  }

  return graph;
}

/**
 * Р РµР·РѕР»РІРёС‚ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Р№ РёРјРїРѕСЂС‚ РІ СЂРµР°Р»СЊРЅС‹Р№ РїСѓС‚СЊ С„Р°Р№Р»Р°
 */
function resolveImport(
  importPath: string,
  fromDir: string,
  existingFiles: Map<string, ParsedCodeFile>
): string | null {
  if (existingFiles.has(importPath)) {
    return importPath;
  }
  if (!importPath.startsWith('.')) {
    return null;
  }
  // РќРѕСЂРјР°Р»РёР·СѓРµРј РїСѓС‚СЊ
  const resolved = path.join(fromDir, importPath).replace(/\\/g, '/');
  
  // Р’РѕР·РјРѕР¶РЅС‹Рµ СЂР°СЃС€РёСЂРµРЅРёСЏ
  const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
  // Р’РѕР·РјРѕР¶РЅС‹Рµ РІР°СЂРёР°РЅС‚С‹ (СЃ index)
  const variants = [
    resolved,
    `${resolved}/index`,
  ];

  for (const variant of variants) {
    for (const ext of extensions) {
      const candidate = variant + ext;
      if (existingFiles.has(candidate)) {
        return candidate;
      }
    }
  }

  // РџРѕРїСЂРѕР±СѓРµРј Р±РµР· .js СЂР°СЃС€РёСЂРµРЅРёСЏ (РґР»СЏ РёРјРїРѕСЂС‚РѕРІ С‚РёРїР° './parser.js')
  const withoutExt = resolved.replace(/\.(js|jsx)$/, '');
  for (const ext of ['.ts', '.tsx']) {
    const candidate = withoutExt + ext;
    if (existingFiles.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveGoImport(
  importPath: string,
  goImportIndex: Map<string, string>
): string | null {
  return goImportIndex.get(importPath) ?? null;
}

function buildGoImportIndex(goFiles: ParsedGoFileEntry[]): Map<string, string> {
  const index = new Map<string, string>();

  for (const file of goFiles) {
    if (!file.modulePath) {
      continue;
    }

    const normalized = normalizeFilePath(file.path);
    const moduleRoot = normalizeFilePath(file.moduleRoot || '.');
    const dir = path.posix.dirname(normalized);
    const relativeDir = moduleRoot === '.' ? dir : path.posix.relative(moduleRoot, dir);

    if (relativeDir.startsWith('..')) {
      continue;
    }

    const importPath = relativeDir === '.' ? file.modulePath : `${file.modulePath}/${relativeDir}`;
    if (!index.has(importPath)) {
      index.set(importPath, normalized);
    }
  }

  return index;
}

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}


/**
 * РџРѕРґСЃС‡РёС‚С‹РІР°РµС‚ СЃС‚Р°С‚РёСЃС‚РёРєСѓ РіСЂР°С„Р°
 */
export function getGraphStats(graph: DependencyGraph): {
  totalFiles: number;
  totalDependencies: number;
  totalExports: number;
  avgDependencies: number;
} {
  const totalFiles = Object.keys(graph.files).length;
  const totalDependencies = Object.values(graph.dependencies)
    .reduce((sum, deps) => sum + deps.length, 0);
  const totalExports = Object.values(graph.files)
    .reduce((sum, file) => sum + file.exports.length, 0);
  
  return {
    totalFiles,
    totalDependencies,
    totalExports,
    avgDependencies: totalFiles > 0 ? totalDependencies / totalFiles : 0,
  };
}


type ParsedCodeFile = {
  path: string;
  exports: ExportSymbol[];
  imports: ImportList;
  linesOfCode: number;
};

type ParsedGoFileEntry = NonNullable<ScanResult['goFiles']>[number];