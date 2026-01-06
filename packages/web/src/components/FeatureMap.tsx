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
  Panel,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { FeatureNode, type FeatureNodeData } from './FeatureNode';
import { CommentNode } from './CommentNode';
import { COMMENT_EDGE_TYPE } from '@/lib/commentTypes';
import type { GraphData, MapEntity, NodeType } from '@/lib/types';

interface FeatureMapProps {
  graph: GraphData;
  entities: Record<string, MapEntity>;
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
}

const nodeTypes: NodeTypes = {
  feature: FeatureNode,
  cluster: FeatureNode,
  comment: CommentNode,
};

const edgeTypes: EdgeTypes = {
  [COMMENT_EDGE_TYPE]: BezierEdge,
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function FeatureMap({
  graph,
  entities,
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
    return getLayoutedElements(graphNodes, graphEdges, 'TB');
  }, [graphEdges, graphNodes]);

  const layoutedNodes = useMemo(
    () => [...layoutedGraphNodes, ...commentNodes],
    [commentNodes, layoutedGraphNodes]
  );
  const layoutedEdges = useMemo(
    () => [...layoutedGraphEdges, ...commentEdges],
    [commentEdges, layoutedGraphEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
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
      onNodesChange(changes);
      if (!onNodeRemove) {
        return;
      }
      for (const change of changes) {
        if (change.type === 'remove') {
          onNodeRemove(change.id);
        }
      }
    },
    [onNodeRemove, onNodesChange]
  );

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeDragStop?.(node);
    },
    [onNodeDragStop]
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
        <Panel
          position="top-left"
          className="bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm text-sm text-gray-600"
        >
          {graph.nodes.length + commentNodes.length} nodes -{' '}
          {graph.edges.length + commentEdges.length} connections
        </Panel>
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
