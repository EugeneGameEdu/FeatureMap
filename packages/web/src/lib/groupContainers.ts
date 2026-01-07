import type { Node } from '@xyflow/react';
import type { GroupSummary } from './types';

export const GROUP_CONTAINER_NODE_TYPE = 'group_container';

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 70;
const HEADER_HEIGHT = 36;
const NOTE_HEIGHT = 44;

export interface GroupContainerData {
  groupId: string;
  name: string;
  description?: string;
  note?: string;
  headerHeight: number;
  noteHeight: number;
  isSelected: boolean;
  onSelectGroup?: (groupId: string) => void;
}

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
}: BuildGroupContainerNodesInput): Array<Node<GroupContainerData>> {
  const nodesById = new Map(visibleNodes.map((node) => [node.id, node]));
  const containerNodes: Array<Node<GroupContainerData>> = [];

  for (const group of groups) {
    const memberIds = membership.get(group.id) ?? [];
    const memberNodes = memberIds.map((id) => nodesById.get(id)).filter(isDefined);

    if (memberNodes.length === 0) {
      continue;
    }

    const bounds = resolveBounds(memberNodes);
    const noteHeight = group.note ? NOTE_HEIGHT : 0;
    const position = {
      x: bounds.minX - padding,
      y: bounds.minY - padding - HEADER_HEIGHT,
    };
    const size = {
      width: bounds.maxX - bounds.minX + padding * 2,
      height: bounds.maxY - bounds.minY + padding * 2 + HEADER_HEIGHT + noteHeight,
    };

    containerNodes.push({
      id: `group-container:${group.id}`,
      type: GROUP_CONTAINER_NODE_TYPE,
      position,
      data: {
        groupId: group.id,
        name: group.name,
        description: group.description,
        note: group.note,
        headerHeight: HEADER_HEIGHT,
        noteHeight,
        isSelected: group.id === selectedGroupId,
        onSelectGroup,
      },
      selectable: false,
      draggable: false,
      deletable: false,
      connectable: false,
      focusable: false,
      style: {
        width: size.width,
        height: size.height,
        zIndex: 0,
      },
    });
  }

  return containerNodes;
}

function resolveBounds(nodes: Node[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const width = resolveNodeWidth(node);
    const height = resolveNodeHeight(node);
    const position = node.positionAbsolute ?? node.position;
    const left = position.x;
    const top = position.y;
    const right = left + width;
    const bottom = top + height;

    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, right);
    maxY = Math.max(maxY, bottom);
  }

  return { minX, minY, maxX, maxY };
}

function resolveNodeWidth(node: Node): number {
  const measured = (node as Node & { measured?: { width?: number } }).measured;
  return node.width ?? measured?.width ?? DEFAULT_NODE_WIDTH;
}

function resolveNodeHeight(node: Node): number {
  const measured = (node as Node & { measured?: { height?: number } }).measured;
  return node.height ?? measured?.height ?? DEFAULT_NODE_HEIGHT;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
