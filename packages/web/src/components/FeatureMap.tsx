import { useCallback, useEffect, useMemo, type MouseEvent } from 'react';
import {
  Background,
  BezierEdge,
  ConnectionMode,
  Controls,
  Edge,
  type EdgeChange,
  type Connection,
  type NodeChange,
  Node,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FeatureNode, type FeatureNodeData } from './FeatureNode';
import { CommentNode } from './CommentNode';
import { GroupContainerNode } from './GroupContainerNode';
import { COMMENT_EDGE_TYPE } from '@/lib/commentTypes';
import {
  buildGroupContainerNodes,
  GROUP_CONTAINER_NODE_TYPE,
} from '@/lib/groupContainers';
import { applyGroupDragChanges, collectMemberPositions, getGroupIdFromContainer } from '@/lib/groupDrag';
import { applyLayoutPositions, getLayoutedElements } from '@/lib/graphLayout';
import type { GraphData, GroupSummary, MapEntity, NodeType } from '@/lib/types';

interface FeatureMapProps {
  graph: GraphData;
  entities: Record<string, MapEntity>;
  layoutPositions?: Record<string, { x: number; y: number }>;
  groups?: GroupSummary[];
  groupMembership?: Map<string, string[]>;
  selectedGroupId?: string;
  selectedGroupDetailsId?: string | null;
  onGroupSelect?: (groupId: string) => void;
  commentNodes?: Node[];
  commentEdges?: Edge[];
  onNodeClick?: (featureId: string) => void;
  onPaneClick?: (event: MouseEvent) => void;
  onConnect?: (connection: Connection) => void;
  onEdgeRemove?: (edgeId: string) => void;
  onNodeDragStop?: (node: Node) => void;
  onNodeRemove?: (nodeId: string) => void;
  commentPlacementActive?: boolean;
  onInit?: (instance: ReactFlowInstance) => void;
  selectedNodeId?: string | null;
  focusedNodeId?: string | null;
  focusedUntil?: number | null;
  onGroupDragStop?: (positions: Record<string, { x: number; y: number }>) => void;
}

const nodeTypes: NodeTypes = {
  feature: FeatureNode,
  cluster: FeatureNode,
  comment: CommentNode,
  [GROUP_CONTAINER_NODE_TYPE]: GroupContainerNode,
};

const edgeTypes: EdgeTypes = {
  [COMMENT_EDGE_TYPE]: BezierEdge,
};

export function FeatureMap({
  graph,
  entities,
  layoutPositions = {},
  groups = [],
  groupMembership,
  selectedGroupId = 'all',
  selectedGroupDetailsId,
  onGroupSelect,
  commentNodes = [],
  commentEdges = [],
  onNodeClick,
  onPaneClick,
  onConnect,
  onEdgeRemove,
  onNodeDragStop,
  onNodeRemove,
  commentPlacementActive = false,
  onInit,
  selectedNodeId,
  focusedNodeId,
  focusedUntil,
  onGroupDragStop,
}: FeatureMapProps) {
  const dependencyCountById = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const edge of graph.edges) {
      counts[edge.source] = (counts[edge.source] ?? 0) + 1;
    }
    return counts;
  }, [graph.edges]);

  const graphNodes: Node[] = useMemo(() => {
    return graph.nodes.map((node) => {
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
          isFocused,
        },
        position: { x: 0, y: 0 },
        selected: node.id === selectedNodeId,
        deletable: false,
        zIndex: 2,
      };
    });
  }, [graph.nodes, entities, dependencyCountById, selectedNodeId, focusedNodeId, focusedUntil]);

  const graphEdges: Edge[] = useMemo(() => {
    return graph.edges.map((edge, index) => ({
      id: `e${index}-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'bezier',
      animated: false,
      deletable: false,
      style: { stroke: '#9ca3af', strokeWidth: 2 },
      markerEnd: {
        type: 'arrowclosed' as const,
        color: '#9ca3af',
      },
    }));
  }, [graph.edges]);

  const { nodes: layoutedGraphNodes, edges: layoutedGraphEdges } = useMemo(() => {
    const layouted = getLayoutedElements(graphNodes, graphEdges, 'TB');
    return {
      nodes: applyLayoutPositions(layouted.nodes, layoutPositions),
      edges: layouted.edges,
    };
  }, [graphEdges, graphNodes, layoutPositions]);

  const groupContainerNodes = useMemo(() => {
    if (groups.length === 0) {
      return [];
    }
    const activeGroups =
      selectedGroupId === 'all' ? groups : groups.filter((group) => group.id === selectedGroupId);
    return buildGroupContainerNodes({
      visibleNodes: layoutedGraphNodes,
      groups: activeGroups,
      membership: groupMembership ?? new Map(),
      padding: 40,
      selectedGroupId: selectedGroupDetailsId ?? null,
      onSelectGroup: onGroupSelect,
    });
  }, [
    groups,
    groupMembership,
    layoutedGraphNodes,
    onGroupSelect,
    selectedGroupDetailsId,
    selectedGroupId,
  ]);

  const layoutedNodes = useMemo(
    () => [...groupContainerNodes, ...layoutedGraphNodes, ...commentNodes],
    [commentNodes, groupContainerNodes, layoutedGraphNodes]
  );
  const layoutedEdges = useMemo(
    () => [...layoutedGraphEdges, ...commentEdges],
    [commentEdges, layoutedGraphEdges]
  );

  const [nodes, setNodes] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === GROUP_CONTAINER_NODE_TYPE) {
        return;
      }
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      if (!onEdgeRemove) {
        return;
      }
      for (const change of changes) {
        if (change.type === 'remove') {
          onEdgeRemove(change.id);
        }
      }
    },
    [onEdgeRemove, onEdgesChange]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((currentNodes) => applyGroupDragChanges(changes, currentNodes, groupMembership ?? new Map()));
      if (!onNodeRemove) {
        return;
      }
      for (const change of changes) {
        if (change.type === 'remove') {
          onNodeRemove(change.id);
        }
      }
    },
    [groupMembership, onNodeRemove, setNodes]
  );

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === GROUP_CONTAINER_NODE_TYPE) {
        const groupId = getGroupIdFromContainer(node.id);
        if (!groupId || !onGroupDragStop) {
          return;
        }
        const memberIds = groupMembership?.get(groupId) ?? [];
        const positions = collectMemberPositions(nodes, memberIds);
        onGroupDragStop(positions);
        return;
      }
      onNodeDragStop?.(node);
    },
    [groupMembership, nodes, onGroupDragStop, onNodeDragStop]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        onInit={onInit}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        className={commentPlacementActive ? 'cursor-crosshair' : ''}
        defaultEdgeOptions={{
          type: 'bezier',
        }}
      >
        <Background color="#e5e7eb" gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function resolveSource(entity: MapEntity | undefined): FeatureNodeData['source'] {
  if (!entity || entity.kind !== 'feature') {
    return 'auto';
  }

  if (entity.data.metadata.lastModifiedBy === 'ai' || entity.data.source === 'ai') {
    return 'ai';
  }

  return entity.data.source === 'user' ? 'user' : 'auto';
}
