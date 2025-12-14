import { Project, SourceFile, SyntaxKind } from 'ts-morph';

export interface FileExport {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum' | 'unknown';
  isDefault: boolean;
}

export interface FileImports {
  internal: string[];  // относительные импорты (./foo, ../bar)
  external: string[];  // пакеты (react, commander)
}

export interface ParsedFile {
  path: string;
  exports: FileExport[];
  imports: FileImports;
  linesOfCode: number;
}

// Создаём один Project для переиспользования
let project: Project | null = null;

function getProject(): Project {
  if (!project) {
    project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    });
  }
  return project;
}

export function parseFile(filePath: string): ParsedFile {
  const proj = getProject();
  
  // Добавляем файл в проект (или получаем существующий)
  let sourceFile: SourceFile;
  try {
    sourceFile = proj.addSourceFileAtPath(filePath);
  } catch {
    // Если файл уже добавлен, получаем его
    sourceFile = proj.getSourceFileOrThrow(filePath);
  }

  const exports = extractExports(sourceFile);
  const imports = extractImports(sourceFile);
  const linesOfCode = sourceFile.getEndLineNumber();

  // Удаляем файл из проекта чтобы не накапливать память
  proj.removeSourceFile(sourceFile);

  return {
    path: filePath,
    exports,
    imports,
    linesOfCode,
  };
}

function extractExports(sourceFile: SourceFile): FileExport[] {
  const exports: FileExport[] = [];

  // Экспортированные функции
  for (const fn of sourceFile.getFunctions()) {
    if (fn.isExported()) {
      exports.push({
        name: fn.getName() || 'anonymous',
        type: 'function',
        isDefault: fn.isDefaultExport(),
      });
    }
  }

  // Экспортированные классы
  for (const cls of sourceFile.getClasses()) {
    if (cls.isExported()) {
      exports.push({
        name: cls.getName() || 'anonymous',
        type: 'class',
        isDefault: cls.isDefaultExport(),
      });
    }
  }

  // Экспортированные переменные (const, let, var)
  for (const varStatement of sourceFile.getVariableStatements()) {
    if (varStatement.isExported()) {
      for (const declaration of varStatement.getDeclarations()) {
        exports.push({
          name: declaration.getName(),
          type: 'variable',
          isDefault: false,
        });
      }
    }
  }

  // Экспортированные интерфейсы
  for (const iface of sourceFile.getInterfaces()) {
    if (iface.isExported()) {
      exports.push({
        name: iface.getName(),
        type: 'interface',
        isDefault: false,
      });
    }
  }

  // Экспортированные типы
  for (const typeAlias of sourceFile.getTypeAliases()) {
    if (typeAlias.isExported()) {
      exports.push({
        name: typeAlias.getName(),
        type: 'type',
        isDefault: false,
      });
    }
  }

  // Экспортированные enum
  for (const enumDecl of sourceFile.getEnums()) {
    if (enumDecl.isExported()) {
      exports.push({
        name: enumDecl.getName(),
        type: 'enum',
        isDefault: false,
      });
    }
  }

  // Default export (если это выражение, а не declaration)
  const defaultExport = sourceFile.getDefaultExportSymbol();
  if (defaultExport && !exports.some(e => e.isDefault)) {
    exports.push({
      name: 'default',
      type: 'unknown',
      isDefault: true,
    });
  }

  return exports;
}

function extractImports(sourceFile: SourceFile): FileImports {
  const internal: string[] = [];
  const external: string[] = [];

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    
    // Относительные импорты начинаются с . или ..
    if (moduleSpecifier.startsWith('.')) {
      internal.push(moduleSpecifier);
    } else {
      external.push(moduleSpecifier);
    }
  }

  // Убираем дубликаты
  return {
    internal: [...new Set(internal)],
    external: [...new Set(external)],
  };
}

// Утилита для очистки проекта (если нужно освободить память)
export function resetParser(): void {
  if (project) {
    project = null;
  }
}
