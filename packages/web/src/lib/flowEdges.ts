import type { Edge } from '@xyflow/react';
import { COMMENT_EDGE_TYPE } from './commentTypes';
import { cn } from './utils';

export function buildStyledEdges({
  edges,
  selectedEdgeId,
  selectedNodeId,
  dependencyEdgeIds,
  dependentEdgeIds,
}: {
  edges: Edge[];
  selectedEdgeId?: string | null;
  selectedNodeId?: string | null;
  dependencyEdgeIds?: Set<string>;
  dependentEdgeIds?: Set<string>;
}): Edge[] {
  if (edges.length === 0) {
    return edges;
  }

  const hasNodeSelection = Boolean(selectedNodeId);

  return edges.map((edge) => {
    if (edge.type === COMMENT_EDGE_TYPE) {
      return edge;
    }

    const isSelected = selectedEdgeId === edge.id;
    const isDependency = dependencyEdgeIds?.has(edge.id) ?? false;
    const isDependent = dependentEdgeIds?.has(edge.id) ?? false;
    const isConnected = isDependency || isDependent;
    const isDimmed = hasNodeSelection && !isConnected && !isSelected;

    const markerColor = isSelected
      ? 'hsl(var(--primary))'
      : isDependency
      ? 'var(--edge-dependency)'
      : isDependent
      ? 'var(--edge-dependent)'
      : isDimmed
      ? 'hsl(var(--border) / 0.3)'
      : 'hsl(var(--border))';
    const zIndex = isSelected ? 3 : hasNodeSelection && isConnected ? 2 : hasNodeSelection ? 1 : edge.zIndex;
    const markerEnd = edge.markerEnd;
    const nextMarkerEnd =
      markerEnd && typeof markerEnd === 'object'
        ? { ...markerEnd, color: markerColor }
        : markerEnd ?? { type: 'arrowclosed' as const, color: markerColor };

    return {
      ...edge,
      zIndex,
      markerEnd: nextMarkerEnd,
      className: cn(
        edge.className,
        'edge-base transition-all duration-200',
        isSelected && 'edge-selected',
        !isSelected && hasNodeSelection && isDependency && 'edge-dependency',
        !isSelected && hasNodeSelection && !isDependency && isDependent && 'edge-dependent',
        isDimmed && 'edge-dimmed'
      ),
    };
  });
}
