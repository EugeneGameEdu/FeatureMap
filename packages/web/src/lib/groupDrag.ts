import { applyNodeChanges, type Node, type NodeChange } from '@xyflow/react';
import { GROUP_CONTAINER_ID_PREFIX } from './groupContainers';

export function applyGroupDragChanges(
  changes: NodeChange[],
  nodes: Node[],
  groupMembership: Map<string, string[]>
): Node[] {
  const groupDeltas = collectGroupDeltas(changes, nodes);
  if (groupDeltas.length === 0) {
    return applyNodeChanges(changes, nodes);
  }

  const nextNodes = applyNodeChanges(changes, nodes);
  const deltaByNodeId = new Map<string, { x: number; y: number }>();

  for (const { groupId, deltaX, deltaY } of groupDeltas) {
    const memberIds = groupMembership.get(groupId) ?? [];
    for (const memberId of memberIds) {
      if (!deltaByNodeId.has(memberId)) {
        deltaByNodeId.set(memberId, { x: deltaX, y: deltaY });
      }
    }
  }

  return nextNodes.map((node) => {
    const delta = deltaByNodeId.get(node.id);
    if (!delta) {
      return node;
    }
    if (node.type !== 'feature' && node.type !== 'cluster') {
      return node;
    }
    return {
      ...node,
      position: {
        x: node.position.x + delta.x,
        y: node.position.y + delta.y,
      },
    };
  });
}

export function collectMemberPositions(
  nodes: Node[],
  memberIds: string[]
): Record<string, { x: number; y: number }> {
  const memberSet = new Set(memberIds);
  const positions: Record<string, { x: number; y: number }> = {};

  for (const node of nodes) {
    if (!memberSet.has(node.id)) {
      continue;
    }
    if (node.type !== 'feature' && node.type !== 'cluster') {
      continue;
    }
    positions[node.id] = { x: node.position.x, y: node.position.y };
  }

  return positions;
}

export function getGroupIdFromContainer(nodeId: string): string | null {
  return nodeId.startsWith(GROUP_CONTAINER_ID_PREFIX)
    ? nodeId.slice(GROUP_CONTAINER_ID_PREFIX.length)
    : null;
}

function collectGroupDeltas(
  changes: NodeChange[],
  nodes: Node[]
): Array<{ groupId: string; deltaX: number; deltaY: number }> {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const deltas = new Map<string, { deltaX: number; deltaY: number }>();

  for (const change of changes) {
    if (change.type !== 'position' || !change.position) {
      continue;
    }
    const groupId = getGroupIdFromContainer(change.id);
    if (!groupId) {
      continue;
    }
    const previous = nodesById.get(change.id);
    if (!previous) {
      continue;
    }
    deltas.set(groupId, {
      deltaX: change.position.x - previous.position.x,
      deltaY: change.position.y - previous.position.y,
    });
  }

  return [...deltas.entries()].map(([groupId, delta]) => ({
    groupId,
    deltaX: delta.deltaX,
    deltaY: delta.deltaY,
  }));
}
