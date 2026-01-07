import { applyNodeChanges, type Node, type NodeChange } from '@xyflow/react';
import { GROUP_CONTAINER_ID_PREFIX } from './groupContainers';

export interface GroupDragStateEntry {
  containerStart: { x: number; y: number };
  memberPositions: Record<string, { x: number; y: number }>;
}

export function applyGroupDragChanges(
  changes: NodeChange[],
  nodes: Node[],
  groupMembership: Map<string, string[]>,
  dragState: Map<string, GroupDragStateEntry>
): Node[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const nextNodes = applyNodeChanges(changes, nodes);
  const memberUpdates = new Map<string, { x: number; y: number }>();
  let hasGroupDrag = false;

  for (const change of changes) {
    if (change.type !== 'position' || !change.position) {
      continue;
    }
    const groupId = getGroupIdFromContainer(change.id);
    if (!groupId) {
      continue;
    }
    hasGroupDrag = true;
    let dragStart = dragState.get(groupId);
    if (!dragStart) {
      const containerNode = nodesById.get(change.id);
      if (!containerNode) {
        continue;
      }
      const memberIds = groupMembership.get(groupId) ?? [];
      dragStart = {
        containerStart: { ...containerNode.position },
        memberPositions: collectMemberPositions(nodes, memberIds),
      };
      dragState.set(groupId, dragStart);
    }

    const deltaX = change.position.x - dragStart.containerStart.x;
    const deltaY = change.position.y - dragStart.containerStart.y;
    for (const [memberId, position] of Object.entries(dragStart.memberPositions)) {
      memberUpdates.set(memberId, { x: position.x + deltaX, y: position.y + deltaY });
    }

    if (change.dragging === false) {
      dragState.delete(groupId);
    }
  }

  if (!hasGroupDrag) {
    return nextNodes;
  }

  return nextNodes.map((node) => {
    const nextPosition = memberUpdates.get(node.id);
    if (!nextPosition) {
      return node;
    }
    if (node.type !== 'feature' && node.type !== 'cluster') {
      return node;
    }
    return {
      ...node,
      position: nextPosition,
      ...(node.positionAbsolute ? { positionAbsolute: nextPosition } : {}),
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
    const position = node.positionAbsolute ?? node.position;
    positions[node.id] = { x: position.x, y: position.y };
  }

  return positions;
}

export function getGroupIdFromContainer(nodeId: string): string | null {
  return nodeId.startsWith(GROUP_CONTAINER_ID_PREFIX)
    ? nodeId.slice(GROUP_CONTAINER_ID_PREFIX.length)
    : null;
}
