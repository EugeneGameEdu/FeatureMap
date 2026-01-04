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
import type { Feature, GraphData } from '@/lib/types';

interface FeatureMapProps {
  graph: GraphData;
  features: Record<string, Feature>;
  onNodeClick?: (featureId: string) => void;
  selectedNodeId?: string | null;
}

const nodeTypes: NodeTypes = {
  feature: FeatureNode,
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

export function FeatureMap({ graph, features, onNodeClick, selectedNodeId }: FeatureMapProps) {
  const initialNodes: Node[] = useMemo(() => {
    return graph.nodes.map((node) => {
      const feature = features[node.id];
      return {
        id: node.id,
        type: 'feature',
        data: {
          label: node.label,
          fileCount: node.fileCount,
          source: feature?.source || 'auto',
          status: feature?.status || 'active',
          dependencyCount: feature?.dependsOn?.length || 0,
        },
        position: { x: 0, y: 0 },
        selected: node.id === selectedNodeId,
      };
    });
  }, [graph.nodes, features, selectedNodeId]);

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

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

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
          {graph.nodes.length} features • {graph.edges.length} connections
        </Panel>
      </ReactFlow>
    </div>
  );
}
