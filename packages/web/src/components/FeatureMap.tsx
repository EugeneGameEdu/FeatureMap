import { useCallback, useEffect, useMemo, useRef, type MouseEvent } from 'react';
import {
  Background, BezierEdge, ConnectionMode, ControlButton, Controls, Edge,
  type Connection, type EdgeChange, type NodeChange, Node, ReactFlow, type ReactFlowInstance,
  useEdgesState, useNodesState, type EdgeTypes, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Lock, Unlock } from 'lucide-react';
import { FeatureNode } from './FeatureNode';
import { CommentNode } from './CommentNode';
import { GroupContainerNode } from './GroupContainerNode';
import { COMMENT_EDGE_TYPE } from '@/lib/commentTypes';
import { buildDependencyCountById, buildGraphEdges, buildGraphNodes } from '@/lib/featureMapElements';
import { buildGroupContainerNodes, GROUP_CONTAINER_NODE_TYPE } from '@/lib/groupContainers';
import { applyGroupDragChanges, collectMemberPositions, getGroupIdFromContainer, type GroupDragStateEntry } from '@/lib/groupDrag';
import { applyLayoutPositions, getLayoutedElements } from '@/lib/graphLayout';
import type { EdgeStyle, GraphData, GroupSummary, MapEntity } from '@/lib/types';
import { cn } from '@/lib/utils';

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
  onEdgeClick?: (event: MouseEvent, edge: Edge) => void;
  onConnect?: (connection: Connection) => void;
  onEdgeRemove?: (edgeId: string) => void;
  onNodeDragStop?: (node: Node) => void;
  onNodeRemove?: (nodeId: string) => void;
  commentPlacementActive?: boolean;
  onInit?: (instance: ReactFlowInstance) => void;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  connectedEdgeIds?: Set<string>;
  connectedNodeIds?: Set<string>;
  hiddenNodeIds?: Set<string>;
  focusedNodeId?: string | null;
  focusedUntil?: number | null;
  onGroupDragStop?: (positions: Record<string, { x: number; y: number }>) => void;
  readOnly?: boolean;
  onToggleReadOnly?: () => void;
  edgeStyle?: EdgeStyle;
  collapsedGroupIds?: Set<string>;
  onGroupCollapseToggle?: (groupId: string) => void;
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
  onEdgeClick,
  onConnect,
  onEdgeRemove,
  onNodeDragStop,
  onNodeRemove,
  commentPlacementActive = false,
  onInit,
  selectedNodeId,
  selectedEdgeId,
  connectedEdgeIds,
  connectedNodeIds,
  hiddenNodeIds,
  focusedNodeId,
  focusedUntil,
  onGroupDragStop,
  readOnly = false,
  onToggleReadOnly,
  edgeStyle = 'bezier',
  collapsedGroupIds,
  onGroupCollapseToggle,
}: FeatureMapProps) {
  const isReadOnly = Boolean(readOnly);
  const dependencyCountById = useMemo(() => buildDependencyCountById(graph.edges), [graph.edges]);

  const graphNodes: Node[] = useMemo(
    () => buildGraphNodes({ nodes: graph.nodes, entities, dependencyCountById, connectedNodeIds, selectedNodeId, focusedNodeId, focusedUntil }),
    [graph.nodes, entities, dependencyCountById, connectedNodeIds, selectedNodeId, focusedNodeId, focusedUntil]
  );

  const graphEdges: Edge[] = useMemo(
    () => buildGraphEdges(graph.edges, edgeStyle),
    [graph.edges, edgeStyle]
  );

  const { nodes: layoutedGraphNodes, edges: layoutedGraphEdges } = useMemo(() => {
    const layouted = getLayoutedElements(graphNodes, graphEdges, 'TB');
    return {
      nodes: applyLayoutPositions(layouted.nodes, layoutPositions),
      edges: layouted.edges,
    };
  }, [graphEdges, graphNodes, layoutPositions]);

  const visibleGraphNodes = useMemo(() => {
    if (!hiddenNodeIds || hiddenNodeIds.size === 0) {
      return layoutedGraphNodes;
    }
    return layoutedGraphNodes.filter((node) => !hiddenNodeIds.has(node.id));
  }, [hiddenNodeIds, layoutedGraphNodes]);

  const visibleNodeIds = useMemo(() => {
    return new Set(visibleGraphNodes.map((node) => node.id));
  }, [visibleGraphNodes]);

  const visibleGraphEdges = useMemo(() => {
    if (!hiddenNodeIds || hiddenNodeIds.size === 0) {
      return layoutedGraphEdges;
    }
    return layoutedGraphEdges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [hiddenNodeIds, layoutedGraphEdges, visibleNodeIds]);

  const groupContainerNodes = useMemo(() => {
    if (groups.length === 0) return [];
    const activeGroups = selectedGroupId === 'all' ? groups : groups.filter((group) => group.id === selectedGroupId);
    return buildGroupContainerNodes({
      visibleNodes: layoutedGraphNodes,
      groups: activeGroups,
      membership: groupMembership ?? new Map(),
      padding: 40,
      selectedGroupId: selectedGroupDetailsId ?? null,
      onSelectGroup: onGroupSelect,
      collapsedGroupIds,
      onToggleCollapsed: onGroupCollapseToggle,
    });
  }, [collapsedGroupIds, groupMembership, groups, layoutedGraphNodes, onGroupCollapseToggle, onGroupSelect, selectedGroupDetailsId, selectedGroupId]);

  const layoutedNodes = useMemo(
    () => [...groupContainerNodes, ...visibleGraphNodes, ...commentNodes],
    [commentNodes, groupContainerNodes, visibleGraphNodes]
  );
  const layoutedEdges = useMemo(() => {
    if (commentEdges.length === 0) {
      return visibleGraphEdges;
    }
    const allNodeIds = new Set([...visibleNodeIds, ...commentNodes.map((node) => node.id)]);
    const filteredComments = commentEdges.filter(
      (edge) => allNodeIds.has(edge.source) && allNodeIds.has(edge.target)
    );
    return [...visibleGraphEdges, ...filteredComments];
  }, [commentEdges, commentNodes, visibleGraphEdges, visibleNodeIds]);

  const [nodes, setNodes] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);
  const nodesRef = useRef<Node[]>(layoutedNodes);
  const groupDragStateRef = useRef<Map<string, GroupDragStateEntry>>(new Map());

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    nodesRef.current = layoutedNodes;
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const styledEdges = useMemo(() => {
    if (edges.length === 0) {
      return edges;
    }
    return edges.map((edge) => {
      if (edge.type === COMMENT_EDGE_TYPE) {
        return edge;
      }
      const isSelected = selectedEdgeId === edge.id;
      const isConnected = connectedEdgeIds?.has(edge.id) ?? false;
      const hasNodeSelection = Boolean(selectedNodeId);
      const isDimmed = hasNodeSelection && !isConnected && !isSelected;

      const markerColor = isSelected
        ? 'hsl(var(--primary))'
        : hasNodeSelection && isConnected
        ? 'hsl(var(--primary) / 0.55)'
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
          !isSelected && hasNodeSelection && isConnected && 'edge-connected',
          isDimmed && 'edge-dimmed'
        ),
      };
    });
  }, [edges, selectedEdgeId, selectedNodeId, connectedEdgeIds]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === GROUP_CONTAINER_NODE_TYPE) {
        return;
      }
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  const handleNodeDragStart = useCallback(
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
        edges={styledEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStart={handleNodeDragStart}
        onEdgeClick={onEdgeClick}
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
        defaultEdgeOptions={{ type: edgeStyle }}
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
