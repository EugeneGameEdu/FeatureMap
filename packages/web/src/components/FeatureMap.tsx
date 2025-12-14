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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { Feature, GraphData } from '@/lib/types';

interface FeatureMapProps {
  graph: GraphData;
  features: Record<string, Feature>;
  onNodeClick?: (featureId: string) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 80 });

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

export function FeatureMap({ graph, features, onNodeClick }: FeatureMapProps) {
  const initialNodes: Node[] = useMemo(() => {
    return graph.nodes.map((node) => {
      const feature = features[node.id];
      return {
        id: node.id,
        type: 'default',
        data: {
          label: (
            <div className="text-center">
              <div className="font-medium text-sm">{node.label}</div>
              <div className="text-xs text-gray-500">{node.fileCount} files</div>
            </div>
          ),
        },
        position: { x: 0, y: 0 },
        style: {
          width: NODE_WIDTH,
          backgroundColor: feature?.source === 'ai' ? '#dbeafe' : '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          padding: '8px',
        },
      };
    });
  }, [graph.nodes, features]);

  const initialEdges: Edge[] = useMemo(() => {
    return graph.edges.map((edge, index) => ({
      id: `e${index}-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#9ca3af' },
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={2}
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls />
        <Panel position="top-left" className="bg-white p-2 rounded shadow text-sm">
          {graph.nodes.length} features • {graph.edges.length} connections
        </Panel>
      </ReactFlow>
    </div>
  );
}
