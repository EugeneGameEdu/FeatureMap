import type { Node } from '@xyflow/react';
import type { GroupSummary } from './types';

export const GROUP_CONTAINER_PADDING = 40;
export const GROUP_HEADER_HEIGHT = 36;
export const GROUP_NOTE_HEIGHT = 44;
export const GROUP_PACK_MARGIN = 80;

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 70;

export interface GroupRectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  noteHeight: number;
}

interface BuildGroupRectanglesInput {
  nodesById: Map<string, Node>;
  groups: GroupSummary[];
  membership: Map<string, string[]>;
  padding?: number;
}

export function buildGroupRectangles({
  nodesById,
  groups,
  membership,
  padding = GROUP_CONTAINER_PADDING,
}: BuildGroupRectanglesInput): GroupRectangle[] {
  const rectangles: GroupRectangle[] = [];

  for (const group of groups) {
    const memberIds = membership.get(group.id) ?? [];
    const memberNodes = memberIds.map((id) => nodesById.get(id)).filter(isDefined);
    if (memberNodes.length === 0) {
      continue;
    }

    const bounds = resolveBounds(memberNodes);
    const noteHeight = group.note ? GROUP_NOTE_HEIGHT : 0;
    rectangles.push({
      id: group.id,
      x: bounds.minX - padding,
      y: bounds.minY - padding - GROUP_HEADER_HEIGHT,
      width: bounds.maxX - bounds.minX + padding * 2,
      height: bounds.maxY - bounds.minY + padding * 2 + GROUP_HEADER_HEIGHT + noteHeight,
      noteHeight,
    });
  }

  return rectangles;
}

export function packGroupRectangles(
  rectangles: GroupRectangle[],
  margin: number = GROUP_PACK_MARGIN
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  if (rectangles.length === 0) {
    return positions;
  }

  const sorted = [...rectangles].sort((a, b) => a.id.localeCompare(b.id));
  const totalArea = sorted.reduce((sum, rect) => sum + rect.width * rect.height, 0);
  const maxWidth = Math.max(...sorted.map((rect) => rect.width));
  const maxRowWidth = Math.max(maxWidth, Math.ceil(Math.sqrt(totalArea)));

  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const rect of sorted) {
    if (cursorX > 0 && cursorX + rect.width > maxRowWidth) {
      cursorX = 0;
      cursorY += rowHeight + margin;
      rowHeight = 0;
    }

    positions.set(rect.id, { x: cursorX, y: cursorY });
    cursorX += rect.width + margin;
    rowHeight = Math.max(rowHeight, rect.height);
  }

  return positions;
}

function resolveBounds(nodes: Node[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const width = resolveNodeWidth(node);
    const height = resolveNodeHeight(node);
    const position = node.position;
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
