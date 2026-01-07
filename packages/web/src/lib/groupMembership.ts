import type { GroupSummary, MapEntity, ViewMode } from './types';

export interface GroupMember {
  id: string;
  label: string;
  kind: 'feature' | 'cluster';
  missing?: boolean;
}

export function buildGroupMembership(
  groups: GroupSummary[],
  entities: Record<string, MapEntity>,
  viewMode: ViewMode
): Map<string, string[]> {
  const membership = new Map<string, string[]>();

  for (const group of groups) {
    const memberIds =
      viewMode === 'features'
        ? normalizeStringList(group.featureIds)
        : normalizeStringList(getClusterIdsForGroup(group, entities));
    membership.set(group.id, memberIds);
  }

  return membership;
}

export function buildGroupMembers(
  group: GroupSummary,
  entities: Record<string, MapEntity>,
  viewMode: ViewMode
): GroupMember[] {
  const memberIds =
    viewMode === 'features'
      ? normalizeStringList(group.featureIds)
      : normalizeStringList(getClusterIdsForGroup(group, entities));

  const members = memberIds.map((id) => {
    const entity = entities[id];
    if (!entity) {
      return { id, label: id, kind: viewMode === 'features' ? 'feature' : 'cluster', missing: true };
    }
    const label = entity.kind === 'feature' ? entity.data.name : entity.label;
    return { id, label, kind: entity.kind };
  });

  return members.sort((a, b) => {
    const labelCompare = a.label.localeCompare(b.label);
    if (labelCompare !== 0) {
      return labelCompare;
    }
    return a.id.localeCompare(b.id);
  });
}

function getClusterIdsForGroup(
  group: GroupSummary,
  entities: Record<string, MapEntity>
): string[] {
  const clusterIds = new Set<string>();

  for (const featureId of group.featureIds) {
    const entity = entities[featureId];
    if (!entity || entity.kind !== 'feature') {
      continue;
    }
    for (const clusterId of entity.data.clusters) {
      clusterIds.add(clusterId);
    }
  }

  return [...clusterIds];
}

function normalizeStringList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
