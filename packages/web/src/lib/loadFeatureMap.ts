import { loadContextFiles } from './contextLoader';
import {
  ClusterSchema,
  FeatureDetails,
  FeatureSchema,
  GraphSchema,
  type Cluster,
  type Feature,
  type FeatureClusterDetail,
  type FeatureMapData,
  type GraphData,
  type GraphEdge,
  type GraphNode,
  type MapEntity,
  type NodeType,
} from './types';
import { parseYamlWithSchema } from './yamlParsing';

const DATA_BASE_URL = '/featuremap-data';
const FEATURE_DEP_EDGE_TYPE = 'feature_dep';
const FEATURE_CONTAINS_EDGE_TYPE = 'contains';

export async function loadFeatureMap(): Promise<FeatureMapData> {
  const context = await loadContextFiles();
  const graph = await loadGraphYaml();
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

  const entities: Record<string, MapEntity> = {};
  for (const node of clusterGraph.nodes) {
    const cluster = clustersById.get(node.id);
    if (cluster) {
      entities[node.id] = { kind: 'cluster', label: node.label ?? node.id, data: cluster };
    }
  }

  for (const node of featureGraph.nodes) {
    const feature = featureDetailsById.get(node.id);
    if (feature) {
      entities[node.id] = { kind: 'feature', label: node.label ?? node.id, data: feature };
    }
  }

  return { graph, clusterGraph, featureGraph, entities, context };
}

async function loadGraphYaml(): Promise<GraphData> {
  const response = await fetch(`${DATA_BASE_URL}/graph.yaml`);

  if (!response.ok) {
    throw new Error(`Failed to load graph.yaml: ${response.statusText}`);
  }

  const text = await response.text();
  return parseYamlWithSchema(text, GraphSchema, 'graph.yaml');
}

async function loadClusterYaml(clusterId: string): Promise<Cluster> {
  const response = await fetch(`${DATA_BASE_URL}/clusters/${clusterId}.yaml`);

  if (!response.ok) {
    throw new Error(`Failed to load cluster ${clusterId}: ${response.statusText}`);
  }

  const text = await response.text();
  return parseYamlWithSchema(text, ClusterSchema, `clusters/${clusterId}.yaml`);
}

async function loadFeatureYaml(featureId: string): Promise<Feature> {
  const response = await fetch(`${DATA_BASE_URL}/features/${featureId}.yaml`);

  if (!response.ok) {
    throw new Error(`Failed to load feature ${featureId}: ${response.statusText}`);
  }

  const text = await response.text();
  return parseYamlWithSchema(text, FeatureSchema, `features/${featureId}.yaml`);
}

async function loadClustersById(ids: Set<string>): Promise<Map<string, Cluster>> {
  const clusters = new Map<string, Cluster>();
  await Promise.all(
    [...ids].map(async (clusterId) => {
      const cluster = await loadClusterYamlSafe(clusterId);
      if (cluster) {
        clusters.set(clusterId, cluster);
      }
    })
  );
  return clusters;
}

async function loadFeaturesById(ids: Set<string>): Promise<Map<string, Feature>> {
  const features = new Map<string, Feature>();
  await Promise.all(
    [...ids].map(async (featureId) => {
      const feature = await loadFeatureYamlSafe(featureId);
      if (feature) {
        features.set(featureId, feature);
      }
    })
  );
  return features;
}

async function loadClusterYamlSafe(clusterId: string): Promise<Cluster | null> {
  try {
    return await loadClusterYaml(clusterId);
  } catch (error) {
    console.warn(`Failed to load cluster ${clusterId}:`, error);
    return null;
  }
}

async function loadFeatureYamlSafe(featureId: string): Promise<Feature | null> {
  try {
    return await loadFeatureYaml(featureId);
  } catch (error) {
    console.warn(`Failed to load feature ${featureId}:`, error);
    return null;
  }
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
