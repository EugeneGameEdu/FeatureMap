import * as fs from 'fs';
import type { PackageJsonData } from './techStackHelpers.js';
import { readPackageJson } from './techStackHelpers.js';
import { categorizeDependency, type DependencySource } from './tech-stack-categorizer.js';

export type DependencyType = 'production' | 'development';

interface DependencyRecord {
  name: string;
  versions: Set<string>;
  types: Set<DependencyType>;
  source: DependencySource;
}

export interface FrameworkDependency {
  name: string;
  version?: string;
  category: string;
  type: DependencyType;
  usage?: string;
}

export interface DependencyListEntry {
  name: string;
  version?: string;
}

export interface DependencyAggregation {
  count: number;
  category: string;
  versions?: string;
}

export interface DependencySummary {
  frameworks: FrameworkDependency[];
  dependencies: DependencyListEntry[];
  aggregations: Record<string, DependencyAggregation>;
}

const DEV_PREFERRED_CATEGORIES = new Set(['Build Tools', 'Linting', 'Testing']);

const REQUIRE_BLOCK_REGEX = /^\s*require\s*\(([\s\S]*?)\)/gm;
const REQUIRE_SINGLE_REGEX = /^\s*require\s+([^\s]+)\s+([^\s]+)/gm;

export function collectDependencyRecords(
  packageJsonPaths: string[],
  goModPaths: string[]
): DependencyRecord[] {
  const records = new Map<string, DependencyRecord>();

  for (const packageJsonPath of packageJsonPaths) {
    const pkg = readPackageJson(packageJsonPath);
    if (!pkg) {
      continue;
    }

    addDependencyGroup(records, pkg.dependencies, 'production', 'npm');
    addDependencyGroup(records, pkg.peerDependencies, 'production', 'npm');
    addDependencyGroup(records, pkg.optionalDependencies, 'production', 'npm');
    addDependencyGroup(records, pkg.devDependencies, 'development', 'npm');
  }

  for (const goModPath of goModPaths) {
    const deps = readGoDependencies(goModPath);
    for (const dep of deps) {
      addDependency(records, dep.name, dep.version, 'production', 'go');
    }
  }

  return Array.from(records.values());
}

export function buildDependencySummary(
  records: DependencyRecord[],
  usageByName?: Map<string, string>
): DependencySummary {
  const frameworks: FrameworkDependency[] = [];

  for (const record of records) {
    const category = categorizeDependency(record.name, record.source);
    if (category === null) {
      continue;
    }

    const version = summarizeVersions(record.versions);
    const type = resolveDependencyType(record.types, category);
    const usage = usageByName?.get(record.name);

    frameworks.push({
      name: record.name,
      version,
      category,
      type,
      usage,
    });
  }

  frameworks.sort((a, b) => a.name.localeCompare(b.name));

  const dependencies = frameworks.map((entry) => ({
    name: entry.name,
    version: entry.version,
  }));

  return {
    frameworks,
    dependencies,
    aggregations: buildAggregations(frameworks),
  };
}

function addDependencyGroup(
  records: Map<string, DependencyRecord>,
  dependencies: PackageJsonData['dependencies'] | undefined,
  type: DependencyType,
  source: DependencySource
): void {
  if (!dependencies) {
    return;
  }

  for (const [name, version] of Object.entries(dependencies)) {
    addDependency(records, name, version, type, source);
  }
}

function addDependency(
  records: Map<string, DependencyRecord>,
  name: string,
  version: string | undefined,
  type: DependencyType,
  source: DependencySource
): void {
  const key = `${source}:${name}`;
  const existing =
    records.get(key) ?? { name, versions: new Set<string>(), types: new Set<DependencyType>(), source };

  if (version) {
    existing.versions.add(version);
  }

  existing.types.add(type);
  records.set(key, existing);
}

function summarizeVersions(versions: Set<string>): string | undefined {
  const list = Array.from(versions).filter(Boolean).sort((a, b) => a.localeCompare(b));
  if (list.length === 0) {
    return undefined;
  }
  if (list.length === 1) {
    return list[0];
  }
  return `${list[0]} - ${list[list.length - 1]}`;
}

function buildAggregations(frameworks: FrameworkDependency[]): Record<string, DependencyAggregation> {
  const groupMap = new Map<string, FrameworkDependency[]>();

  for (const framework of frameworks) {
    const key = getScopeAggregationKey(framework.name);
    if (!key) {
      continue;
    }
    const existing = groupMap.get(key) ?? [];
    existing.push(framework);
    groupMap.set(key, existing);
  }

  const entries: Array<[string, DependencyAggregation]> = [];

  for (const [key, group] of groupMap) {
    if (group.length < 3) {
      continue;
    }

    const category = pickAggregationCategory(group);
    const versions = summarizeVersions(
      new Set(group.map((entry) => entry.version).filter((version): version is string => !!version))
    );

    entries.push([
      key,
      {
        count: group.length,
        category,
        ...(versions ? { versions } : {}),
      },
    ]);
  }

  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return Object.fromEntries(entries);
}

function getScopeAggregationKey(name: string): string | null {
  if (!name.startsWith('@')) {
    return null;
  }

  const [scope, pkgName] = name.split('/');
  if (!scope || !pkgName) {
    return null;
  }

  const prefix = pkgName.split('-')[0];
  if (!prefix) {
    return null;
  }

  const suffix = pkgName.includes('-') ? `${prefix}-*` : `${prefix}*`;
  return `${scope}/${suffix}`;
}

function pickAggregationCategory(group: FrameworkDependency[]): string {
  const counts = new Map<string, number>();
  for (const entry of group) {
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });

  return sorted[0]?.[0] ?? 'Other';
}

function resolveDependencyType(
  types: Set<DependencyType>,
  category: string
): DependencyType {
  if (types.has('development') && DEV_PREFERRED_CATEGORIES.has(category)) {
    return 'development';
  }

  if (types.has('production')) {
    return 'production';
  }

  return 'development';
}

function readGoDependencies(goModPath: string): Array<{ name: string; version?: string }> {
  if (!fs.existsSync(goModPath)) {
    return [];
  }

  const content = fs.readFileSync(goModPath, 'utf8');
  const dependencies = new Map<string, string | undefined>();

  for (const match of content.matchAll(REQUIRE_BLOCK_REGEX)) {
    const block = match[1] ?? '';
    for (const line of block.split(/\r?\n/)) {
      const parsed = parseGoDependencyLine(line);
      if (parsed) {
        dependencies.set(parsed.name, parsed.version);
      }
    }
  }

  for (const match of content.matchAll(REQUIRE_SINGLE_REGEX)) {
    const name = match[1];
    const version = match[2];
    if (name) {
      dependencies.set(name, version);
    }
  }

  return Array.from(dependencies.entries())
    .map(([name, version]) => ({ name, version }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseGoDependencyLine(line: string): { name: string; version?: string } | null {
  const trimmed = stripGoModComment(line).trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 0) {
    return null;
  }

  const name = parts[0];
  const version = parts[1];
  return name ? { name, version } : null;
}

function stripGoModComment(line: string): string {
  const index = line.indexOf('//');
  if (index === -1) {
    return line;
  }
  return line.slice(0, index);
}
