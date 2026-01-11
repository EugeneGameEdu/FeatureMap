import type { Node } from '@xyflow/react';
import type { GroupSummary } from './types';
import { buildGroupRectangles, GROUP_HEADER_HEIGHT } from './groupPacking';

export const GROUP_CONTAINER_NODE_TYPE = 'group_container';
export const GROUP_CONTAINER_ID_PREFIX = 'group-container:';

export interface GroupContainerData extends Record<string, unknown> {
  groupId: string;
  name: string;
  description?: string;
  note?: string;
  headerHeight: number;
  noteHeight: number;
  isSelected: boolean;
  onSelectGroup?: (groupId: string) => void;
}

export type GroupContainerNode = Node<GroupContainerData, typeof GROUP_CONTAINER_NODE_TYPE>;

interface BuildGroupContainerNodesInput {
  visibleNodes: Node[];
  groups: GroupSummary[];
  membership: Map<string, string[]>;
  padding: number;
  selectedGroupId?: string | null;
  onSelectGroup?: (groupId: string) => void;
}

export function buildGroupContainerNodes({
  visibleNodes,
  groups,
  membership,
  padding,
  selectedGroupId,
  onSelectGroup,
}: BuildGroupContainerNodesInput): GroupContainerNode[] {
  const nodesById = new Map(visibleNodes.map((node) => [node.id, node]));
  const rectangles = buildGroupRectangles({ nodesById, groups, membership, padding });
  const containerNodes: GroupContainerNode[] = [];

  for (const rect of rectangles) {
    const group = groups.find((entry) => entry.id === rect.id);
    if (!group) {
      continue;
    }

    containerNodes.push({
      id: `${GROUP_CONTAINER_ID_PREFIX}${rect.id}`,
      type: GROUP_CONTAINER_NODE_TYPE,
      position: { x: rect.x, y: rect.y },
      className: 'group-container pointer-events-none',
      dragHandle: '.group-container__header',
      data: {
        groupId: rect.id,
        name: group.name,
        description: group.description,
        note: group.note,
        headerHeight: GROUP_HEADER_HEIGHT,
        noteHeight: rect.noteHeight,
        isSelected: rect.id === selectedGroupId,
        onSelectGroup,
      },
      selectable: false,
      draggable: rect.id === selectedGroupId,
      deletable: false,
      connectable: false,
      focusable: false,
      style: {
        width: rect.width,
        height: rect.height,
        pointerEvents: 'none',
        zIndex: 0,
      },
    });
  }

  return containerNodes;
}
