import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import type {
  ConventionsInfo,
  Constraint,
  Decision,
  Overview,
  TechStackInfo,
} from '../types/context.js';

export interface ProjectContext {
  techStack: TechStackInfo | null;
  conventions: ConventionsInfo | null;
  decisions: Decision[] | null;
  constraints: Constraint[] | null;
  overview: Overview | null;
}

export function loadProjectContext(featuremapDir: string): ProjectContext {
  const contextDir = join(featuremapDir, 'context');
  const decisionsFile = loadContextFile<{ decisions?: Decision[] }>(contextDir, 'decisions.yaml');
  const constraintsFile = loadContextFile<{ constraints?: Constraint[] }>(
    contextDir,
    'constraints.yaml'
  );

  return {
    techStack: loadContextFile<TechStackInfo>(contextDir, 'tech-stack.yaml'),
    conventions: loadContextFile<ConventionsInfo>(contextDir, 'conventions.yaml'),
    decisions: decisionsFile?.decisions ?? null,
    constraints: constraintsFile?.constraints ?? null,
    overview: loadContextFile<Overview>(contextDir, 'overview.yaml'),
  };
}

function loadContextFile<T>(dir: string, filename: string): T | null {
  const filePath = join(dir, filename);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return parse(content) as T;
  } catch {
    return null;
  }
}
