import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import type { RunCommands } from '../types/context.js';
import { readPackageJson } from './techStackHelpers.js';

export interface RunCommandsDetectionInput {
  projectRoot: string;
  packageJsonPaths: string[];
  goModPaths: string[];
}

type CommandSource = 'package.json' | 'go.mod' | 'dockerfile' | 'inferred';

interface CommandEntry {
  command: string;
  source: CommandSource;
  verified: boolean;
}

const COMMAND_PRIORITY = [
  'dev',
  'start',
  'build',
  'test',
  'lint',
  'format',
  'typecheck',
  'type-check',
  'check',
  'serve',
  'watch',
  'clean',
  'preview',
];

export function detectRunCommands(input: RunCommandsDetectionInput): RunCommands {
  const rootPackagePath = path.join(input.projectRoot, 'package.json');
  const rootCommands: Record<string, CommandEntry> = {};

  // 1. Package.json scripts (highest priority, verified)
  const rootScripts = extractPackageJsonScripts(rootPackagePath);
  for (const [name, command] of Object.entries(rootScripts)) {
    rootCommands[name] = {
      command,
      source: 'package.json',
      verified: true,
    };
  }

  // 2. Go commands (inferred from cmd/*/main.go pattern)
  const goCommands = detectGoCommands(input.projectRoot, input.goModPaths);
  for (const [name, entry] of Object.entries(goCommands)) {
    if (!rootCommands[name]) {
      rootCommands[name] = entry;
    }
  }

  // 3. Dockerfile commands (best effort, unverified)
  const dockerCommands = detectDockerfileCommands(input.projectRoot);
  for (const [name, entry] of Object.entries(dockerCommands)) {
    if (!rootCommands[name]) {
      rootCommands[name] = entry;
    }
  }

  const sortedCommands = sortCommandsByPriority(rootCommands);

  // Detect subproject commands for monorepos
  const subprojects = detectSubprojectCommands(
    input.projectRoot,
    input.packageJsonPaths,
    rootPackagePath
  );

  const result: RunCommands = {
    version: SUPPORTED_VERSIONS.context,
    source: 'auto',
    detectedAt: new Date().toISOString(),
    commands: sortedCommands,
  };

  if (Object.keys(subprojects).length > 0) {
    result.subprojects = subprojects;
  }

  return result;
}

function extractPackageJsonScripts(pkgPath: string): Record<string, string> {
  const pkg = readPackageJson(pkgPath);
  if (!pkg?.scripts) {
    return {};
  }

  const scripts: Record<string, string> = {};
  for (const [name, command] of Object.entries(pkg.scripts)) {
    if (typeof command === 'string') {
      scripts[name] = command;
    }
  }
  return scripts;
}

function detectGoCommands(
  projectRoot: string,
  goModPaths: string[]
): Record<string, CommandEntry> {
  const commands: Record<string, CommandEntry> = {};

  for (const goModPath of goModPaths) {
    const goModDir = path.dirname(goModPath);
    const cmdDir = path.join(goModDir, 'cmd');

    if (!fs.existsSync(cmdDir)) {
      continue;
    }

    const cmdEntries = fg.sync('*/main.go', {
      cwd: cmdDir,
      onlyFiles: true,
    });

    for (const entry of cmdEntries) {
      const cmdName = path.dirname(entry);
      const relativePath = path.relative(projectRoot, path.join(cmdDir, cmdName));
      const normalizedPath = relativePath.replace(/\\/g, '/');

      commands[`run:${cmdName}`] = {
        command: `go run ./${normalizedPath}`,
        source: 'go.mod',
        verified: false,
      };
    }
  }

  return commands;
}

function detectDockerfileCommands(projectRoot: string): Record<string, CommandEntry> {
  const commands: Record<string, CommandEntry> = {};

  const dockerfiles = fg.sync(['Dockerfile', 'dockerfile', '*.Dockerfile'], {
    cwd: projectRoot,
    onlyFiles: true,
    ignore: ['**/node_modules/**'],
  });

  for (const dockerfile of dockerfiles) {
    const filePath = path.join(projectRoot, dockerfile);
    const parsed = parseDockerfile(filePath);

    if (parsed.cmd) {
      const name =
        dockerfile === 'Dockerfile'
          ? 'docker:cmd'
          : `docker:${path.basename(dockerfile, '.Dockerfile')}:cmd`;
      commands[name] = {
        command: parsed.cmd,
        source: 'dockerfile',
        verified: false,
      };
    }

    if (parsed.entrypoint) {
      const name =
        dockerfile === 'Dockerfile'
          ? 'docker:entrypoint'
          : `docker:${path.basename(dockerfile, '.Dockerfile')}:entrypoint`;
      commands[name] = {
        command: parsed.entrypoint,
        source: 'dockerfile',
        verified: false,
      };
    }
  }

  return commands;
}

function parseDockerfile(filePath: string): { cmd?: string; entrypoint?: string } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let cmd: string | undefined;
    let entrypoint: string | undefined;

    for (const line of lines) {
      const trimmed = line.trim();

      const cmdMatch = trimmed.match(/^CMD\s+(.+)$/i);
      if (cmdMatch) {
        cmd = parseDockerCommand(cmdMatch[1]);
      }

      const entrypointMatch = trimmed.match(/^ENTRYPOINT\s+(.+)$/i);
      if (entrypointMatch) {
        entrypoint = parseDockerCommand(entrypointMatch[1]);
      }
    }

    return { cmd, entrypoint };
  } catch {
    return {};
  }
}

function parseDockerCommand(raw: string): string {
  const trimmed = raw.trim();

  // JSON array format: ["executable", "param1", "param2"]
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as string[];
      return parsed.join(' ');
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function detectSubprojectCommands(
  projectRoot: string,
  packageJsonPaths: string[],
  rootPackagePath: string
): Record<string, { path: string; commands: Record<string, CommandEntry> }> {
  const subprojects: Record<
    string,
    { path: string; commands: Record<string, CommandEntry> }
  > = {};

  const rootResolved = path.resolve(rootPackagePath);

  for (const pkgPath of packageJsonPaths) {
    if (path.resolve(pkgPath) === rootResolved) {
      continue;
    }

    const scripts = extractPackageJsonScripts(pkgPath);
    if (Object.keys(scripts).length === 0) {
      continue;
    }

    const pkg = readPackageJson(pkgPath);
    const relativePath = path
      .relative(projectRoot, path.dirname(pkgPath))
      .replace(/\\/g, '/');
    const packageName = pkg?.name || path.basename(path.dirname(pkgPath));

    const commands: Record<string, CommandEntry> = {};
    for (const [name, command] of Object.entries(scripts)) {
      commands[name] = {
        command,
        source: 'package.json',
        verified: true,
      };
    }

    subprojects[packageName] = {
      path: relativePath,
      commands: sortCommandsByPriority(commands),
    };
  }

  return subprojects;
}

function sortCommandsByPriority(
  commands: Record<string, CommandEntry>
): Record<string, CommandEntry> {
  const entries = Object.entries(commands);

  entries.sort(([nameA], [nameB]) => {
    const indexA = COMMAND_PRIORITY.indexOf(nameA);
    const indexB = COMMAND_PRIORITY.indexOf(nameB);

    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    if (indexA !== -1) {
      return -1;
    }
    if (indexB !== -1) {
      return 1;
    }

    return nameA.localeCompare(nameB);
  });

  return Object.fromEntries(entries);
}
