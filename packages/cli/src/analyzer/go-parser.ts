import * as fs from 'fs';
import { z } from 'zod';
import { isInternalImport } from './go-module.js';

export interface GoFileExport {
  name: string;
  type: 'function' | 'type' | 'struct' | 'interface' | 'const' | 'var';
  isPublic: boolean;
}

export interface GoFileImports {
  internal: string[];
  external: string[];
}

export interface ParsedGoFile {
  path: string;
  package: string;
  exports: GoFileExport[];
  imports: GoFileImports;
  linesOfCode: number;
}

const GoFileExportSchema = z.object({
  name: z.string(),
  type: z.enum(['function', 'type', 'struct', 'interface', 'const', 'var']),
  isPublic: z.boolean(),
});

const GoFileImportsSchema = z.object({
  internal: z.array(z.string()),
  external: z.array(z.string()),
});

const ParsedGoFileSchema = z.object({
  path: z.string(),
  package: z.string(),
  exports: z.array(GoFileExportSchema),
  imports: GoFileImportsSchema,
  linesOfCode: z.number().int().nonnegative(),
});

const PACKAGE_REGEX = /^package\s+(\w+)/m;
const IMPORT_BLOCK_REGEX = /^\s*import\s*\(([\s\S]*?)\)/gm;
const IMPORT_SINGLE_REGEX = /^\s*import\s+"([^"]+)"/gm;
const IMPORT_PATH_REGEX = /"([^"]+)"/g;

const FUNCTION_REGEX = /^func\s+(\([^)]*\)\s+)?([A-Za-z_]\w*)\s*\(/gm;
const TYPE_STRUCT_REGEX = /^type\s+([A-Za-z_]\w*)\s+(struct|interface)\b/gm;
const TYPE_ALIAS_REGEX = /^type\s+([A-Za-z_]\w*)\s+(?!struct\b|interface\b)/gm;
const TYPE_BLOCK_REGEX = /^\s*type\s*\(([\s\S]*?)\)/gm;
const CONST_SINGLE_REGEX = /^\s*const\s+([A-Za-z_]\w*)\b/gm;
const CONST_BLOCK_REGEX = /^\s*const\s*\(([\s\S]*?)\)/gm;
const VAR_SINGLE_REGEX = /^\s*var\s+([A-Za-z_]\w*)\b/gm;
const VAR_BLOCK_REGEX = /^\s*var\s*\(([\s\S]*?)\)/gm;

export function parseGoFile(filePath: string, modulePath?: string | null): ParsedGoFile | null {
  const content = fs.readFileSync(filePath, 'utf8');
  if (startsWithGeneratedComment(content)) {
    return null;
  }

  const packageName = content.match(PACKAGE_REGEX)?.[1] ?? 'unknown';
  const imports = parseImports(content, modulePath ?? null);
  const exports = parseExports(content);
  const linesOfCode = countLines(content);

  return ParsedGoFileSchema.parse({
    path: filePath,
    package: packageName,
    exports,
    imports,
    linesOfCode,
  });
}

function startsWithGeneratedComment(content: string): boolean {
  const trimmed = content.trimStart();
  return trimmed.startsWith('// Code generated');
}

function parseImports(content: string, modulePath: string | null): GoFileImports {
  const importPaths = new Set<string>();

  for (const match of content.matchAll(IMPORT_BLOCK_REGEX)) {
    const block = match[1] ?? '';
    for (const value of block.matchAll(IMPORT_PATH_REGEX)) {
      if (value[1]) {
        importPaths.add(value[1]);
      }
    }
  }

  for (const match of content.matchAll(IMPORT_SINGLE_REGEX)) {
    if (match[1]) {
      importPaths.add(match[1]);
    }
  }

  const internal: string[] = [];
  const external: string[] = [];

  for (const value of importPaths) {
    if (modulePath && isInternalImport(value, modulePath)) {
      internal.push(value);
    } else {
      external.push(value);
    }
  }

  internal.sort((a, b) => a.localeCompare(b));
  external.sort((a, b) => a.localeCompare(b));

  return {
    internal,
    external,
  };
}

function parseExports(content: string): GoFileExport[] {
  const exports: GoFileExport[] = [];
  const seen = new Set<string>();

  const addExport = (name: string, type: GoFileExport['type']): void => {
    if (!name) {
      return;
    }
    const key = `${name}|${type}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    exports.push({
      name,
      type,
      isPublic: isPublicName(name),
    });
  };

  for (const match of content.matchAll(FUNCTION_REGEX)) {
    addExport(match[2], 'function');
  }

  for (const match of content.matchAll(TYPE_STRUCT_REGEX)) {
    const name = match[1];
    const type = match[2] === 'interface' ? 'interface' : 'struct';
    addExport(name, type);
  }

  for (const match of content.matchAll(TYPE_ALIAS_REGEX)) {
    addExport(match[1], 'type');
  }

  for (const match of content.matchAll(TYPE_BLOCK_REGEX)) {
    const block = match[1] ?? '';
    addExportsFromTypeBlock(block, addExport);
  }

  for (const match of content.matchAll(CONST_SINGLE_REGEX)) {
    addExport(match[1], 'const');
  }

  for (const match of content.matchAll(CONST_BLOCK_REGEX)) {
    addExportsFromValueBlock(match[1] ?? '', 'const', addExport);
  }

  for (const match of content.matchAll(VAR_SINGLE_REGEX)) {
    addExport(match[1], 'var');
  }

  for (const match of content.matchAll(VAR_BLOCK_REGEX)) {
    addExportsFromValueBlock(match[1] ?? '', 'var', addExport);
  }

  return exports;
}

function addExportsFromValueBlock(
  block: string,
  type: 'const' | 'var',
  addExport: (name: string, type: GoFileExport['type']) => void
): void {
  for (const line of block.split(/\r?\n/)) {
    const trimmed = stripInlineComment(line).trim();
    if (!trimmed) {
      continue;
    }
    const nameMatch = trimmed.match(/^([A-Za-z_]\w*)/);
    if (nameMatch) {
      addExport(nameMatch[1], type);
    }
  }
}

function addExportsFromTypeBlock(
  block: string,
  addExport: (name: string, type: GoFileExport['type']) => void
): void {
  for (const line of block.split(/\r?\n/)) {
    const trimmed = stripInlineComment(line).trim();
    if (!trimmed) {
      continue;
    }
    const structMatch = trimmed.match(/^([A-Za-z_]\w*)\s+(struct|interface)\b/);
    if (structMatch) {
      const type = structMatch[2] === 'interface' ? 'interface' : 'struct';
      addExport(structMatch[1], type);
      continue;
    }
    const nameMatch = trimmed.match(/^([A-Za-z_]\w*)\b/);
    if (nameMatch) {
      addExport(nameMatch[1], 'type');
    }
  }
}

function stripInlineComment(line: string): string {
  const index = line.indexOf('//');
  if (index === -1) {
    return line;
  }
  return line.slice(0, index);
}

function isPublicName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function countLines(content: string): number {
  if (!content) {
    return 0;
  }
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.split('\n').length;
}
