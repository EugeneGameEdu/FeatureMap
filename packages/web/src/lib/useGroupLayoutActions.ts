import { useCallback, useEffect, useState } from 'react';
import type { Node, ReactFlowInstance } from '@xyflow/react';
import type { GroupSummary } from './types';
import { buildGroupRectangles, packGroupRectangles } from './groupPacking';
import { LayoutApiError, useLayoutApi } from './useLayoutApi';

const SESSION_TOKEN_KEY = 'featuremap-session-token';

type LayoutMessageType = 'error' | 'warning' | 'success';

interface LayoutMessage {
  type: LayoutMessageType;
  text: string;
}

interface UseGroupLayoutActionsInput {
  reactFlowInstance: ReactFlowInstance | null;
  groups: GroupSummary[];
  groupMembership: Map<string, string[]>;
  selectedGroupId: string;
  multiGroupNodeIds?: string[];
  onLayoutPositionsChange: (positions: Record<string, { x: number; y: number }>) => void;
}

export function useGroupLayoutActions({
  reactFlowInstance,
  groups,
  groupMembership,
  selectedGroupId,
  multiGroupNodeIds = [],
  onLayoutPositionsChange,
}: UseGroupLayoutActionsInput) {
  const { updateLayoutPositions } = useLayoutApi();
  const [layoutMessage, setLayoutMessage] = useState<LayoutMessage | null>(null);

  useEffect(() => {
    if (!layoutMessage) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setLayoutMessage(null);
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [layoutMessage]);

  const packGroups = useCallback(async () => {
    if (!reactFlowInstance) {
      return;
    }

    const nodes = getVisibleGraphNodes(reactFlowInstance.getNodes());
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const activeGroups =
      selectedGroupId === 'all' ? groups : groups.filter((group) => group.id === selectedGroupId);
    const rectangles = buildGroupRectangles({ nodesById, groups: activeGroups, membership: groupMembership });
    if (rectangles.length === 0) {
      setLayoutMessage({ type: 'warning', text: 'No visible groups to pack.' });
      return;
    }

    if (!hasSessionToken()) {
      setLayoutMessage({
        type: 'error',
        text: 'Token required to save layout (run featuremap serve and paste token).',
      });
      return;
    }

    const packedPositions = packGroupRectangles(rectangles);
    const nextPositions = buildNodePositionUpdates(rectangles, packedPositions, nodesById, groupMembership);

    if (Object.keys(nextPositions).length === 0) {
      setLayoutMessage({ type: 'warning', text: 'No nodes moved.' });
      return;
    }

    onLayoutPositionsChange(nextPositions);

    if (multiGroupNodeIds.length > 0) {
      console.warn('Skipping nodes in multiple groups:', multiGroupNodeIds);
    }

    try {
      await updateLayoutPositions(nextPositions);
      setLayoutMessage({ type: 'success', text: 'Layout saved.' });
    } catch (error) {
      setLayoutMessage(formatLayoutError(error));
    }
  }, [
    groupMembership,
    groups,
    multiGroupNodeIds,
    onLayoutPositionsChange,
    reactFlowInstance,
    selectedGroupId,
    updateLayoutPositions,
  ]);

  const handleGroupDragStop = useCallback(
    async (positions: Record<string, { x: number; y: number }>) => {
      if (Object.keys(positions).length === 0) {
        return;
      }

      onLayoutPositionsChange(positions);

      try {
        await updateLayoutPositions(positions);
        setLayoutMessage({ type: 'success', text: 'Layout saved.' });
      } catch (error) {
        setLayoutMessage(formatLayoutError(error, true));
      }
    },
    [onLayoutPositionsChange, updateLayoutPositions]
  );

  return {
    layoutMessage,
    packGroups,
    handleGroupDragStop,
  };
}

function getVisibleGraphNodes(nodes: Node[]): Node[] {
  return nodes.filter((node) => node.type === 'feature' || node.type === 'cluster');
}

function buildNodePositionUpdates(
  rectangles: Array<{ id: string; x: number; y: number }>,
  packedPositions: Map<string, { x: number; y: number }>,
  nodesById: Map<string, Node>,
  groupMembership: Map<string, string[]>
): Record<string, { x: number; y: number }> {
  const updates: Record<string, { x: number; y: number }> = {};

  for (const rect of rectangles) {
    const target = packedPositions.get(rect.id);
    if (!target) {
      continue;
    }
    const deltaX = target.x - rect.x;
    const deltaY = target.y - rect.y;
    const memberIds = groupMembership.get(rect.id) ?? [];

    for (const memberId of memberIds) {
      const node = nodesById.get(memberId);
      if (!node) {
        continue;
      }
      const basePosition = node.position;
      updates[memberId] = {
        x: basePosition.x + deltaX,
        y: basePosition.y + deltaY,
      };
    }
  }

  return updates;
}

function hasSessionToken(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return Boolean(sessionStorage.getItem(SESSION_TOKEN_KEY));
  } catch {
    return false;
  }
}

function formatLayoutError(error: unknown, allowUnsaved?: boolean): LayoutMessage {
  if (error instanceof LayoutApiError) {
    if (error.type === 'token_missing' || error.type === 'forbidden') {
      return {
        type: allowUnsaved ? 'warning' : 'error',
        text: allowUnsaved
          ? 'Layout moved locally but not saved (missing token).'
          : 'Token required to save layout (run featuremap serve and paste token).',
      };
    }
    if (error.type === 'network') {
      return { type: 'warning', text: 'Layout moved locally but serve API is unavailable.' };
    }
    return { type: 'warning', text: error.message };
  }

  return { type: 'warning', text: 'Layout moved locally but failed to save.' };
}
