import { loadContextFiles } from './contextLoader';
import type {
  Cluster,
  Feature,
  FeatureClusterDetail,
  FeatureDetails,
  FeatureMapData,
  GraphData,
  GraphEdge,
  GraphNode,
  MapEntity,
  NodeType,
} from './types';
import { deriveFeatureLayers } from './layerFilters';
import { loadGroups } from './groupLoader';
import { loadComments } from './commentLoader';
import {
  loadClusterYamlSafe,
  loadClustersById,
  loadFeatureYamlSafe,
  loadFeaturesById,
  loadGraphYaml,
  loadLayoutYaml,
} from './featureMapLoaders';
const FEATURE_DEP_EDGE_TYPE = 'feature_dep';
const FEATURE_CONTAINS_EDGE_TYPE = 'contains';

export async function loadFeatureMap(): Promise<FeatureMapData> {
  const context = await loadContextFiles();
  const graph = await loadGraphYaml();
  const layout = await loadLayoutYaml();
  const clusterGraph = buildClusterGraph(graph);
  const featureGraph = buildFeatureGraph(graph);

  const clusterIds = new Set(clusterGraph.nodes.map((node) => node.id));
  const featureIds = new Set(featureGraph.nodes.map((node) => node.id));

  const clustersById = await loadClustersById(clusterIds);
  const featuresById = await loadFeaturesById(featureIds);

  const referencedClusterIds = new Set<string>();
  for (const feature of featuresById.values()) {
    for (const clusterId of feature.clusters) {
      referencedClusterIds.add(clusterId);
    }
  }

  for (const clusterId of referencedClusterIds) {
    if (clustersById.has(clusterId)) {
      continue;
    }
    const cluster = await loadClusterYamlSafe(clusterId);
    if (cluster) {
      clustersById.set(clusterId, cluster);
    }
  }

  const featureDetailsById = new Map<string, FeatureDetails>();
  for (const [featureId, feature] of featuresById.entries()) {
    const clustersDetailed = feature.clusters.map((clusterId) =>
      buildFeatureClusterDetail(clusterId, clustersById.get(clusterId))
    );
    featureDetailsById.set(featureId, { ...feature, clustersDetailed });
  }

  const clusterGraphWithLayers = attachClusterLayers(clusterGraph, clustersById);
  const featureGraphWithLayers = attachFeatureLayers(featureGraph, featureDetailsById);
  const { groups, groupsById } = await loadGroups(featureDetailsById);
  const comments = await loadComments();

  const entities: Record<string, MapEntity> = {};
  for (const node of clusterGraphWithLayers.nodes) {
    const cluster = clustersById.get(node.id);
    if (cluster) {
      entities[node.id] = { kind: 'cluster', label: node.label ?? node.id, data: cluster };
    }
  }

  for (const node of featureGraphWithLayers.nodes) {
    const feature = featureDetailsById.get(node.id);
    if (feature) {
      entities[node.id] = { kind: 'feature', label: node.label ?? node.id, data: feature };
    }
  }

  return {
    graph,
    clusterGraph: clusterGraphWithLayers,
    featureGraph: featureGraphWithLayers,
    layout,
    entities,
    context,
    groups,
    groupsById,
    comments,
  };
}

function buildClusterGraph(graph: GraphData): GraphData {
  const nodes = graph.nodes
    .filter((node) => node.type !== 'feature')
    .map((node) => normalizeNode(node, 'cluster'));

  const edges = graph.edges.filter(
    (edge) => edge.type !== FEATURE_DEP_EDGE_TYPE && edge.type !== FEATURE_CONTAINS_EDGE_TYPE
  );

  return {
    version: graph.version,
    generatedAt: graph.generatedAt,
    nodes: sortNodes(nodes),
    edges: sortEdges(edges),
  };
}

function buildFeatureGraph(graph: GraphData): GraphData {
  const nodes = graph.nodes
    .filter((node) => node.type === 'feature')
    .map((node) => normalizeNode(node, 'feature'));

  const edges = graph.edges.filter((edge) => edge.type === FEATURE_DEP_EDGE_TYPE);

  return {
    version: graph.version,
    generatedAt: graph.generatedAt,
    nodes: sortNodes(nodes),
    edges: sortEdges(edges),
  };
}

function normalizeNode(node: GraphNode, fallbackType: NodeType): GraphNode {
  return {
    ...node,
    label: node.label ?? node.id,
    type: fallbackType,
  };
}

function sortNodes(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
}

function sortEdges(edges: GraphEdge[]): GraphEdge[] {
  return [...edges].sort((a, b) => {
    const typeA = a.type ?? '';
    const typeB = b.type ?? '';
    if (typeA !== typeB) return typeA.localeCompare(typeB);
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.target.localeCompare(b.target);
  });
}

function buildFeatureClusterDetail(
  clusterId: string,
  cluster: Cluster | undefined
): FeatureClusterDetail {
  if (!cluster) {
    return { id: clusterId, missing: true };
  }

  return {
    id: clusterId,
    layer: cluster.layer,
    purpose_hint: cluster.purpose_hint,
    fileCount: cluster.files.length,
  };
}

function attachClusterLayers(graph: GraphData, clustersById: Map<string, Cluster>): GraphData {
  const nodes = graph.nodes.map((node) => {
    const cluster = clustersById.get(node.id);
    if (!cluster) {
      return node;
    }
    return { ...node, layer: cluster.layer };
  });

  return { ...graph, nodes };
}

function attachFeatureLayers(
  graph: GraphData,
  featuresById: Map<string, FeatureDetails>
): GraphData {
  const nodes = graph.nodes.map((node) => {
    const feature = featuresById.get(node.id);
    if (!feature) {
      return node;
    }
    const layers = deriveFeatureLayers(feature);
    return layers.length > 0 ? { ...node, layers } : node;
  });

  return { ...graph, nodes };
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
}
