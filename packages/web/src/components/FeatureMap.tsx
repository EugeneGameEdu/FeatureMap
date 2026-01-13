import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import {
  Background, BezierEdge, ConnectionMode, ControlButton, Controls, Edge,
  type Connection, Node, ReactFlow, type ReactFlowInstance,
  useEdgesState, useNodesState, type EdgeTypes, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Lock, Unlock } from 'lucide-react';
import { FeatureNode } from './FeatureNode';
import { CommentNode } from './CommentNode';
import { GroupContainerNode } from './GroupContainerNode';
import { COMMENT_EDGE_TYPE } from '@/lib/commentTypes';
import { buildDependencyCountById, buildGraphEdges, buildGraphNodes } from '@/lib/featureMapElements';
import { buildStyledEdges } from '@/lib/flowEdges';
import { mergeMeasuredNodes } from '@/lib/flowNodes';
import { buildGroupContainerNodes, GROUP_CONTAINER_NODE_TYPE } from '@/lib/groupContainers';
import { type GroupDragStateEntry } from '@/lib/groupDrag';
import { applyLayoutPositions, getLayoutedElements } from '@/lib/graphLayout';
import type { EdgeStyle, GraphData, GroupSummary, MapEntity, ViewMode } from '@/lib/types';
import { useFlowHandlers } from '@/lib/useFlowHandlers';

interface FeatureMapProps {
  graph: GraphData;
  entities: Record<string, MapEntity>;
  viewMode: ViewMode;
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
  bezier: BezierEdge,
  [COMMENT_EDGE_TYPE]: BezierEdge,
};

const VIEW_DESCRIPTIONS: Record<ViewMode, string> = {
  clusters: 'Technical view: file organization and module dependencies',
  features: 'Architectural view: what the system does and how parts connect',
};

export function FeatureMap({
  graph,
  entities,
  viewMode,
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
  const viewDescription = VIEW_DESCRIPTIONS[viewMode];

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
    const nextNodes = mergeMeasuredNodes(layoutedNodes, nodesRef.current);
    setNodes(nextNodes);
    setEdges(layoutedEdges);
    nodesRef.current = nextNodes;
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const styledEdges = useMemo(
    () => buildStyledEdges({ edges, selectedEdgeId, selectedNodeId, connectedEdgeIds }),
    [edges, selectedEdgeId, selectedNodeId, connectedEdgeIds]
  );

  const {
    handleNodeClick,
    handleNodeDragStart,
    handleEdgesChange,
    handleNodesChange,
    handleNodeDragStop,
    handlePaneClick,
    handleConnect,
  } = useFlowHandlers({
    isReadOnly,
    groupMembership,
    groupDragStateRef,
    nodesRef,
    setNodes,
    onEdgesChange,
    onEdgeRemove,
    onNodeRemove,
    onNodeClick,
    onNodeDragStop,
    onGroupDragStop,
    onPaneClick,
    onConnect,
  });

  const lockTitle = isReadOnly ? 'Unlock graph (edit mode)' : 'Lock graph (read-only)';

  return (
    <div className="w-full h-full relative">
      <div className="pointer-events-none absolute left-4 right-4 top-3 z-10 text-muted-foreground">
        <span
          key={viewMode}
          className="block text-base sm:text-lg leading-tight animate-in fade-in-0 duration-200"
        >
          {viewDescription}
        </span>
      </div>
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
        proOptions={{ hideAttribution: true }}
        className={commentPlacementActive ? 'cursor-crosshair bg-background' : 'bg-background'}
        defaultEdgeOptions={{ type: edgeStyle }}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        edgesReconnectable={!isReadOnly}
        elementsSelectable
      >
        <Background color="hsl(var(--border))" gap={60} size={3} />
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
