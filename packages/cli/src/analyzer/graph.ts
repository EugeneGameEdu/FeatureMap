import * as path from 'path';
import { parseFile } from './parser.js';
import { ScanResult, getRelativePath } from './scanner.js';
import type { ExportSymbol, ImportList } from '../types/index.js';

export interface FileNode {
  path: string;           // относительный путь
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
  
  const graph: DependencyGraph = {
    files: {},
    dependencies: {},
    dependents: {},
  };

  // Шаг 1: Парсим все файлы
  const parsedFiles: Map<string, ParsedCodeFile> = new Map();
  
  for (const absolutePath of files) {
    const relativePath = getRelativePath(absolutePath, projectRoot);
    const parsed = parseFile(absolutePath);
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
        // filePath úø±±  resolvedPath
        graph.dependencies[filePath].push(resolvedPath);

        // resolvedPath ¿¿ úø±± filePath
        if (graph.dependents[resolvedPath]) {
          graph.dependents[resolvedPath].push(filePath);
        }
      }
    }
  }

  return graph;
}

/**
 * Резолвит относительный импорт в реальный путь файла
 */
function resolveImport(
  importPath: string,
  fromDir: string,
  existingFiles: Map<string, ParsedCodeFile>
): string | null {
  // Нормализуем путь
  const resolved = path.join(fromDir, importPath).replace(/\\/g, '/');
  
  // Возможные расширения
  const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
  // Возможные варианты (с index)
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

  // Попробуем без .js расширения (для импортов типа './parser.js')
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
 * Подсчитывает статистику графа
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
