import { GroupIndexSchema, GroupSchema } from './types';
import type { FeatureDetails, Group, GroupSummary } from './types';
import { parseYamlWithSchema } from './yamlParsing';

const DATA_BASE_URL = '/featuremap-data';

export async function loadGroups(
  featureDetailsById: Map<string, FeatureDetails>
): Promise<{ groups: GroupSummary[]; groupsById: Record<string, GroupSummary> }> {
  const groupIds = await loadGroupIndex();
  if (groupIds.length === 0) {
    return { groups: [], groupsById: {} };
  }

  const groupsById = await loadGroupsById(new Set(groupIds));
  const knownFeatureIds = new Set(featureDetailsById.keys());
  const summaries = [...groupsById.values()].map((group) =>
    buildGroupSummary(group, knownFeatureIds)
  );
  const sortedGroups = sortGroups(summaries);
  return {
    groups: sortedGroups,
    groupsById: Object.fromEntries(sortedGroups.map((group) => [group.id, group])),
  };
}

async function loadGroupIndex(): Promise<string[]> {
  const response = await fetch(`${DATA_BASE_URL}/groups/index.yaml`);

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Failed to load groups index: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (looksLikeHtml(text, contentType)) {
    return [];
  }

  try {
    const parsed = parseYamlWithSchema(text, GroupIndexSchema, 'groups/index.yaml');
    return parsed.groups;
  } catch (error) {
    console.warn('Failed to parse groups/index.yaml:', error);
    return [];
  }
}

async function loadGroupYaml(groupId: string): Promise<Group> {
  const response = await fetch(`${DATA_BASE_URL}/groups/${groupId}.yaml`);

  if (!response.ok) {
    throw new Error(`Failed to load group ${groupId}: ${response.statusText}`);
  }

  const text = await response.text();
  return parseYamlWithSchema(text, GroupSchema, `groups/${groupId}.yaml`);
}

async function loadGroupsById(ids: Set<string>): Promise<Map<string, Group>> {
  const groups = new Map<string, Group>();
  await Promise.all(
    [...ids].map(async (groupId) => {
      const group = await loadGroupYamlSafe(groupId);
      if (group) {
        groups.set(groupId, group);
      }
    })
  );
  return groups;
}

async function loadGroupYamlSafe(groupId: string): Promise<Group | null> {
  try {
    return await loadGroupYaml(groupId);
  } catch (error) {
    console.warn(`Failed to load group ${groupId}:`, error);
    return null;
  }
}

function buildGroupSummary(group: Group, knownFeatureIds: Set<string>): GroupSummary {
  const featureIds = normalizeStringList(group.featureIds);
  const missingFeatureIds = featureIds.filter((featureId) => !knownFeatureIds.has(featureId));

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    note: group.note,
    featureIds,
    source: group.source,
    ...(missingFeatureIds.length > 0 ? { missingFeatureIds } : {}),
  };
}

function sortGroups(groups: GroupSummary[]): GroupSummary[] {
  return [...groups].sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return a.id.localeCompare(b.id);
  });
}

function normalizeStringList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function looksLikeHtml(text: string, contentType: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  if (contentType.includes('text/html')) {
    return true;
  }
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<head');
}
