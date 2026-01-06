import type { GraphEdge, GraphNode, GroupSummary, MapEntity, ViewMode } from './types';

export function applyGroupFilter(
  nodes: GraphNode[],
  edges: GraphEdge[],
  viewMode: ViewMode,
  selectedGroupId: string,
  groupsById: Record<string, GroupSummary>,
  entities: Record<string, MapEntity>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (selectedGroupId === 'all') {
    return { nodes, edges };
  }

  const group = groupsById[selectedGroupId];
  if (!group) {
    return { nodes, edges };
  }

  const visibleIds =
    viewMode === 'features'
      ? new Set(group.featureIds)
      : getClusterIdsForGroup(group, entities);

  const visibleNodes = nodes.filter((node) => visibleIds.has(node.id));
  const visibleEdges = edges.filter(
    (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)
  );

  return { nodes: visibleNodes, edges: visibleEdges };
}

export function getGroupsForFeature(groups: GroupSummary[], featureId: string): GroupSummary[] {
  return groups.filter((group) => group.featureIds.includes(featureId));
}

function getClusterIdsForGroup(
  group: GroupSummary,
  entities: Record<string, MapEntity>
): Set<string> {
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

  return clusterIds;
}
