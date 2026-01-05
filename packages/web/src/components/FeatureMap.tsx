import { useCallback, useMemo } from 'react';
import {
  Background,
  ConnectionMode,
  Controls,
  Edge,
  Node,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { FeatureNode } from './FeatureNode';
import type { GraphData, MapEntity, NodeType } from '@/lib/types';

interface FeatureMapProps {
  graph: GraphData;
  entities: Record<string, MapEntity>;
  onNodeClick?: (featureId: string) => void;
  selectedNodeId?: string | null;
}

const nodeTypes: NodeTypes = {
  feature: FeatureNode,
  cluster: FeatureNode,
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

export function FeatureMap({ graph, entities, onNodeClick, selectedNodeId }: FeatureMapProps) {
  const dependencyCountById = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const edge of graph.edges) {
      counts[edge.source] = (counts[edge.source] ?? 0) + 1;
    }
    return counts;
  }, [graph.edges]);

  const initialNodes: Node[] = useMemo(() => {
    return graph.nodes.map((node) => {
      const entity = entities[node.id];
      const source = entity?.kind === 'feature' ? entity.data.source : 'auto';
      const status = entity?.kind === 'feature' ? entity.data.status : 'active';
      const fileCount = node.fileCount ?? node.clusterCount ?? 0;
      return {
        id: node.id,
        type: node.type,
        data: {
          label: node.label,
          kind: node.type as NodeType,
          fileCount,
          source,
          status,
          dependencyCount: dependencyCountById[node.id] ?? 0,
        },
        position: { x: 0, y: 0 },
        selected: node.id === selectedNodeId,
      };
    });
  }, [graph.nodes, entities, dependencyCountById, selectedNodeId]);

  const initialEdges: Edge[] = useMemo(() => {
    return graph.edges.map((edge, index) => ({
      id: `e${index}-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'bezier',
      animated: false,
      style: { stroke: '#9ca3af', strokeWidth: 2 },
      markerEnd: {
        type: 'arrowclosed' as const,
        color: '#9ca3af',
      },
    }));
  }, [graph.edges]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    return getLayoutedElements(initialNodes, initialEdges, 'TB');
  }, [initialNodes, initialEdges]);

  const [nodes, , onNodesChange] = useNodesState(layoutedNodes);
  const [edges, , onEdgesChange] = useEdgesState(layoutedEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
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
          {graph.nodes.length} nodes - {graph.edges.length} connections
        </Panel>
      </ReactFlow>
    </div>
  );
}
