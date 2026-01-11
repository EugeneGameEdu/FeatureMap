import { useCallback, useEffect, useMemo, useRef, type MouseEvent } from 'react';
import {
  Background,
  BezierEdge,
  ConnectionMode,
  ControlButton,
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
import { Lock, Unlock } from 'lucide-react';
import { FeatureNode, type FeatureNodeData } from './FeatureNode';
import { CommentNode } from './CommentNode';
import { GroupContainerNode } from './GroupContainerNode';
import { COMMENT_EDGE_TYPE } from '@/lib/commentTypes';
import {
  buildGroupContainerNodes,
  GROUP_CONTAINER_NODE_TYPE,
} from '@/lib/groupContainers';
import {
  applyGroupDragChanges,
  collectMemberPositions,
  getGroupIdFromContainer,
  type GroupDragStateEntry,
} from '@/lib/groupDrag';
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
  readOnly?: boolean;
  onToggleReadOnly?: () => void;
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
  readOnly = false,
  onToggleReadOnly,
}: FeatureMapProps) {
  const isReadOnly = Boolean(readOnly);
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
      style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
      markerEnd: {
        type: 'arrowclosed' as const,
        color: 'hsl(var(--border))',
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
  const nodesRef = useRef<Node[]>(layoutedNodes);
  const groupDragStateRef = useRef<Map<string, GroupDragStateEntry>>(new Map());

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    nodesRef.current = layoutedNodes;
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
      const nextChanges = isReadOnly
        ? changes.filter((change) => change.type !== 'remove')
        : changes;
      if (nextChanges.length > 0) {
        onEdgesChange(nextChanges);
      }
      if (isReadOnly || !onEdgeRemove) {
        return;
      }
      for (const change of changes) {
        if (change.type === 'remove') {
          onEdgeRemove(change.id);
        }
      }
    },
    [isReadOnly, onEdgeRemove, onEdgesChange]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((currentNodes) => {
        const nextChanges = isReadOnly
          ? changes.filter((change) => change.type !== 'remove' && change.type !== 'position')
          : changes;
        const nextNodes = applyGroupDragChanges(
          nextChanges,
          currentNodes,
          groupMembership ?? new Map(),
          groupDragStateRef.current
        );
        nodesRef.current = nextNodes;
        return nextNodes;
      });
      if (isReadOnly || !onNodeRemove) {
        return;
      }
      for (const change of changes) {
        if (change.type === 'remove') {
          onNodeRemove(change.id);
        }
      }
    },
    [groupMembership, isReadOnly, onNodeRemove, setNodes]
  );

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (isReadOnly) {
        return;
      }
      if (node.type === GROUP_CONTAINER_NODE_TYPE) {
        const groupId = getGroupIdFromContainer(node.id);
        if (!groupId || !onGroupDragStop) {
          return;
        }
        const memberIds = groupMembership?.get(groupId) ?? [];
        const positions = collectMemberPositions(nodesRef.current, memberIds);
        groupDragStateRef.current.delete(groupId);
        onGroupDragStop(positions);
        return;
      }
      onNodeDragStop?.(node);
    },
    [groupMembership, isReadOnly, onGroupDragStop, onNodeDragStop]
  );

  const handlePaneClick = useCallback(
    (event: MouseEvent) => {
      if (isReadOnly) {
        return;
      }
      onPaneClick?.(event);
    },
    [isReadOnly, onPaneClick]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (isReadOnly) {
        return;
      }
      onConnect?.(connection);
    },
    [isReadOnly, onConnect]
  );

  const lockTitle = isReadOnly ? 'Unlock graph (edit mode)' : 'Lock graph (read-only)';

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
        onPaneClick={handlePaneClick}
        onConnect={handleConnect}
        onNodeDragStop={handleNodeDragStop}
        onInit={onInit}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={isReadOnly ? null : ['Backspace', 'Delete']}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        className={commentPlacementActive ? 'cursor-crosshair bg-background' : 'bg-background'}
        defaultEdgeOptions={{
          type: 'bezier',
        }}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        edgesReconnectable={!isReadOnly}
        elementsSelectable
      >
        <Background color="hsl(var(--border))" gap={20} size={1} />
        <Controls showInteractive={false}>
          <ControlButton
            onClick={onToggleReadOnly}
            title={lockTitle}
            aria-label={lockTitle}
            aria-pressed={isReadOnly}
          >
            {isReadOnly ? <Lock size={16} /> : <Unlock size={16} />}
          </ControlButton>
        </Controls>
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
