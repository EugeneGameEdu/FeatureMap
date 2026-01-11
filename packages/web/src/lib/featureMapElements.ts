import type { Edge, Node } from '@xyflow/react';
import type { EdgeStyle, GraphData, MapEntity, NodeType } from './types';

type NodeSource = 'auto' | 'ai' | 'user';

export function buildDependencyCountById(edges: GraphData['edges']): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const edge of edges) {
    counts[edge.source] = (counts[edge.source] ?? 0) + 1;
  }
  return counts;
}

export function buildEdgeId(edge: GraphData['edges'][number], index: number): string {
  return `e${index}-${edge.source}-${edge.target}`;
}

export function buildGraphNodes({
  nodes,
  entities,
  dependencyCountById,
  connectedNodeIds,
  selectedNodeId,
  focusedNodeId,
  focusedUntil,
}: {
  nodes: GraphData['nodes'];
  entities: Record<string, MapEntity>;
  dependencyCountById: Record<string, number>;
  connectedNodeIds?: Set<string>;
  selectedNodeId?: string | null;
  focusedNodeId?: string | null;
  focusedUntil?: number | null;
}): Node[] {
  return nodes.map((node) => {
    const entity = entities[node.id];
    const source = resolveSource(entity);
    const status = entity?.kind === 'feature' ? entity.data.status : 'active';
    const fileCount = node.fileCount ?? node.clusterCount ?? 0;
    const nodeType = (node.type ?? 'cluster') as NodeType;
    const nodeLayer = nodeType === 'cluster' ? node.layer : undefined;
    const nodeLayers = nodeType === 'feature' ? node.layers : undefined;
    const isFocused =
      focusedNodeId === node.id &&
      typeof focusedUntil === 'number' &&
      focusedUntil > Date.now();

    return {
      id: node.id,
      type: nodeType,
      data: {
        label: node.label ?? node.id,
        kind: nodeType,
        fileCount,
        source,
        status,
        dependencyCount: dependencyCountById[node.id] ?? 0,
        layer: nodeLayer,
        layers: nodeLayers,
        isConnected: connectedNodeIds?.has(node.id) ?? false,
        isFocused,
      },
      position: { x: 0, y: 0 },
      selected: node.id === selectedNodeId,
      deletable: false,
      zIndex: 2,
    };
  });
}

export function buildGraphEdges(edges: GraphData['edges'], edgeType: EdgeStyle): Edge[] {
  return edges.map((edge, index) => ({
    id: buildEdgeId(edge, index),
    source: edge.source,
    target: edge.target,
    type: edgeType,
    animated: false,
    deletable: false,
    selectable: true,
    focusable: true,
    interactionWidth: 12,
    markerEnd: {
      type: 'arrowclosed' as const,
    },
    className: 'edge-base',
  }));
}

function resolveSource(entity: MapEntity | undefined): NodeSource {
  if (!entity || entity.kind !== 'feature') {
    return 'auto';
  }

  if (entity.data.metadata.lastModifiedBy === 'ai' || entity.data.source === 'ai') {
    return 'ai';
  }

  return entity.data.source === 'user' ? 'user' : 'auto';
}
