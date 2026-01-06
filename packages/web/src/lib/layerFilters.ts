import type { FeatureDetails, GraphEdge, GraphNode, Layer, LayerFilter } from './types';

const LAYER_ORDER: Layer[] = ['frontend', 'backend', 'shared', 'infrastructure'];

export function deriveFeatureLayers(feature: FeatureDetails): Layer[] {
  const layers = new Set<Layer>();
  for (const cluster of feature.clustersDetailed) {
    if (cluster.layer) {
      layers.add(cluster.layer);
    }
  }
  return sortLayers([...layers]);
}

export function applyLayerFilter(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedLayer: LayerFilter
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (selectedLayer === 'all') {
    return { nodes, edges };
  }

  const visibleNodes = nodes.filter((node) => {
    if (node.type === 'feature') {
      return node.layers?.includes(selectedLayer) ?? false;
    }
    return node.layer === selectedLayer;
  });

  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = edges.filter(
    (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)
  );

  return { nodes: visibleNodes, edges: visibleEdges };
}

export function getLayerOrder(): Layer[] {
  return [...LAYER_ORDER];
}

function sortLayers(layers: Layer[]): Layer[] {
  return [...layers].sort((a, b) => LAYER_ORDER.indexOf(a) - LAYER_ORDER.indexOf(b));
}
