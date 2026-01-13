import type { TechStack } from '@/lib/contextTypes';

export type TechStackGroupItem = {
  name: string;
  version?: string;
  detail?: string;
  kind: 'aggregation' | 'library';
};

export type TechStackCategoryGroup = {
  category: string;
  count: number;
  items: TechStackGroupItem[];
};

const CATEGORY_ORDER = [
  'UI Framework',
  'UI Components',
  'Visualization',
  'Icons',
  'Validation',
  'Styling',
  'CLI',
  'Code Analysis',
  'Web Server',
  'Build Tools',
  'AI Integration',
  'Testing',
  'Other',
];

export function buildTechStackGroups(techStack?: TechStack): TechStackCategoryGroup[] {
  if (!techStack || !techStack.frameworks || techStack.frameworks.length === 0) {
    return [];
  }

  const aggregations = techStack.aggregations ?? {};
  const aggregationEntries = Object.entries(aggregations).map(([key, value]) => ({
    key,
    ...value,
    matcher: buildPatternMatcher(key),
  }));

  const aggregatedNames = new Set<string>();
  for (const framework of techStack.frameworks) {
    if (aggregationEntries.some((entry) => entry.matcher(framework.name))) {
      aggregatedNames.add(framework.name);
    }
  }

  const groups = new Map<string, TechStackCategoryGroup>();

  for (const entry of aggregationEntries) {
    const category = entry.category ?? 'Other';
    const group = getGroup(groups, category);
    group.items.push({
      name: `${entry.key} (${entry.count} packages)`,
      detail: entry.versions,
      kind: 'aggregation',
    });
    group.count += entry.count;
  }

  for (const framework of techStack.frameworks) {
    if (aggregatedNames.has(framework.name)) {
      continue;
    }

    const category = framework.category ?? 'Other';
    const group = getGroup(groups, category);
    group.items.push({
      name: framework.name,
      version: framework.version,
      kind: 'library',
    });
    group.count += 1;
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    const orderA = CATEGORY_ORDER.indexOf(a.category);
    const orderB = CATEGORY_ORDER.indexOf(b.category);
    if (orderA !== -1 || orderB !== -1) {
      if (orderA === -1) return 1;
      if (orderB === -1) return -1;
      return orderA - orderB;
    }
    return a.category.localeCompare(b.category);
  });

  for (const group of sortedGroups) {
    group.items.sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === 'aggregation' ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
  }

  return sortedGroups;
}

function getGroup(
  groups: Map<string, TechStackCategoryGroup>,
  category: string
): TechStackCategoryGroup {
  const existing = groups.get(category);
  if (existing) {
    return existing;
  }

  const next = { category, count: 0, items: [] };
  groups.set(category, next);
  return next;
}

function buildPatternMatcher(pattern: string): (value: string) => boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`);
  return (value: string) => regex.test(value);
}
