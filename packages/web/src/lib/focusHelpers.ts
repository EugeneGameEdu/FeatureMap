import type { ReactFlowInstance } from '@xyflow/react';

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 70;
const DEFAULT_ZOOM = 1.1;
const DEFAULT_DURATION = 350;

export function focusNode(
  instance: ReactFlowInstance | null,
  nodeId: string,
  options?: { zoom?: number; duration?: number }
): boolean {
  if (!instance) {
    return false;
  }
  const node = instance.getNode(nodeId);
  if (!node) {
    return false;
  }

  const width = node.width ?? DEFAULT_NODE_WIDTH;
  const height = node.height ?? DEFAULT_NODE_HEIGHT;
  const position = node.position;

  instance.setCenter(position.x + width / 2, position.y + height / 2, {
    zoom: options?.zoom ?? DEFAULT_ZOOM,
    duration: options?.duration ?? DEFAULT_DURATION,
  });

  return true;
}

export function buildFocusState(nodeId: string, durationMs = 1500): {
  focusedNodeId: string;
  focusedUntil: number;
} {
  const focusedUntil = Date.now() + durationMs;
  return { focusedNodeId: nodeId, focusedUntil };
}
