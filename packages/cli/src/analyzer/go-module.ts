import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

export interface GoModule {
  modulePath: string;
  goVersion: string;
  dependencies: string[];
  moduleRoot: string;
}

const GoModuleSchema = z.object({
  modulePath: z.string().min(1),
  goVersion: z.string(),
  dependencies: z.array(z.string()),
  moduleRoot: z.string().min(1),
});

const MODULE_REGEX = /^\s*module\s+(\S+)/m;
const GO_VERSION_REGEX = /^\s*go\s+([\d.]+)/m;
const REQUIRE_BLOCK_REGEX = /^\s*require\s*\(([\s\S]*?)\)/gm;
const REQUIRE_SINGLE_REGEX = /^\s*require\s+([^\s]+)\s+/gm;

export function readGoMod(goModPath: string): GoModule | null {
  if (!fs.existsSync(goModPath)) {
    return null;
  }

  const moduleRoot = path.dirname(goModPath);
  const content = fs.readFileSync(goModPath, 'utf8');
  const moduleMatch = content.match(MODULE_REGEX);
  if (!moduleMatch) {
    return null;
  }

  const modulePath = moduleMatch[1];
  const goVersion = content.match(GO_VERSION_REGEX)?.[1] ?? 'unknown';
  const dependencies = new Set<string>();

  for (const match of content.matchAll(REQUIRE_BLOCK_REGEX)) {
    const block = match[1] ?? '';
    for (const line of block.split(/\r?\n/)) {
      const trimmed = stripGoModComment(line).trim();
      if (!trimmed) {
        continue;
      }
      const dep = trimmed.split(/\s+/)[0];
      if (dep) {
        dependencies.add(dep);
      }
    }
  }

  for (const match of content.matchAll(REQUIRE_SINGLE_REGEX)) {
    const dep = match[1];
    if (dep) {
      dependencies.add(dep);
    }
  }

  return GoModuleSchema.parse({
    modulePath,
    goVersion,
    dependencies: [...dependencies].sort((a, b) => a.localeCompare(b)),
    moduleRoot,
  });
}

function stripGoModComment(line: string): string {
  const index = line.indexOf('//');
  if (index === -1) {
    return line;
  }
  return line.slice(0, index);
}

export function isInternalImport(importPath: string, modulePath: string): boolean {
  return importPath === modulePath || importPath.startsWith(`${modulePath}/`);
}
