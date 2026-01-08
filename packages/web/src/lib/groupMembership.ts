import type { GroupSummary, MapEntity, ViewMode } from './types';

export interface GroupMember {
  id: string;
  label: string;
  kind: 'feature' | 'cluster';
  missing?: boolean;
}

export interface PrimaryGroupMembership {
  membership: Map<string, string[]>;
  multiGroupNodeIds: string[];
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

export function buildPrimaryGroupMembership(
  groups: GroupSummary[],
  entities: Record<string, MapEntity>,
  viewMode: ViewMode
): PrimaryGroupMembership {
  const membership = new Map<string, string[]>();
  const groupIdsByNodeId = new Map<string, string[]>();

  for (const group of groups) {
    const memberIds =
      viewMode === 'features'
        ? normalizeStringList(group.featureIds)
        : normalizeStringList(getClusterIdsForGroup(group, entities));
    for (const memberId of memberIds) {
      const groupIds = groupIdsByNodeId.get(memberId) ?? [];
      groupIds.push(group.id);
      groupIdsByNodeId.set(memberId, groupIds);
    }
  }

  const multiGroupNodeIds: string[] = [];

  for (const [nodeId, groupIds] of groupIdsByNodeId.entries()) {
    const sortedGroupIds = normalizeStringList(groupIds);
    if (sortedGroupIds.length > 1) {
      multiGroupNodeIds.push(nodeId);
    }
    const primaryGroupId = sortedGroupIds[0];
    const members = membership.get(primaryGroupId) ?? [];
    members.push(nodeId);
    membership.set(primaryGroupId, members);
  }

  for (const [groupId, memberIds] of membership.entries()) {
    membership.set(groupId, normalizeStringList(memberIds));
  }

  return { membership, multiGroupNodeIds };
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

  const members: GroupMember[] = memberIds.map((id) => {
    const entity = entities[id];
    if (!entity) {
      const kind: GroupMember['kind'] = viewMode === 'features' ? 'feature' : 'cluster';
      return { id, label: id, kind, missing: true };
    }
    const label = entity.kind === 'feature' ? entity.data.name : entity.label;
    const kind: GroupMember['kind'] = entity.kind;
    return { id, label, kind };
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
