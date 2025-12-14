import * as path from 'path';
import { ParsedFile, parseFile } from './parser.js';
import { ScanResult, getRelativePath } from './scanner.js';

export interface FileNode {
  path: string;           // относительный путь
  exports: ParsedFile['exports'];
  imports: ParsedFile['imports'];
  linesOfCode: number;
}

export interface DependencyGraph {
  files: Record<string, FileNode>;
  dependencies: Record<string, string[]>;  // file -> [files it imports]
  dependents: Record<string, string[]>;    // file -> [files that import it]
}

export async function buildGraph(scanResult: ScanResult): Promise<DependencyGraph> {
  const { files, projectRoot } = scanResult;
  
  const graph: DependencyGraph = {
    files: {},
    dependencies: {},
    dependents: {},
  };

  // Шаг 1: Парсим все файлы
  const parsedFiles: Map<string, ParsedFile> = new Map();
  
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

  // Шаг 2: Резолвим внутренние импорты в реальные пути
  for (const [filePath, parsed] of parsedFiles) {
    const fileDir = path.dirname(filePath);
    
    for (const importPath of parsed.imports.internal) {
      const resolvedPath = resolveImport(importPath, fileDir, parsedFiles);
      
      if (resolvedPath) {
        // filePath зависит от resolvedPath
        graph.dependencies[filePath].push(resolvedPath);
        
        // resolvedPath имеет зависимого filePath
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
  existingFiles: Map<string, ParsedFile>
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
