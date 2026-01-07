import {
  ClusterSchema,
  FeatureSchema,
  GraphSchema,
  LayoutSchema,
  type Cluster,
  type Feature,
  type GraphData,
  type Layout,
} from './types';
import { parseYamlWithSchema } from './yamlParsing';

const DATA_BASE_URL = '/featuremap-data';

export async function loadGraphYaml(): Promise<GraphData> {
  const response = await fetch(`${DATA_BASE_URL}/graph.yaml`);

  if (!response.ok) {
    throw new Error(`Failed to load graph.yaml: ${response.statusText}`);
  }

  const text = await response.text();
  return parseYamlWithSchema(text, GraphSchema, 'graph.yaml');
}

export async function loadLayoutYaml(): Promise<Layout> {
  const response = await fetch(`${DATA_BASE_URL}/layout.yaml`);

  if (!response.ok) {
    if (response.status === 404) {
      return buildEmptyLayout();
    }
    throw new Error(`Failed to load layout.yaml: ${response.statusText}`);
  }

  const text = await response.text();

  try {
    return parseYamlWithSchema(text, LayoutSchema, 'layout.yaml');
  } catch (error) {
    console.warn('Failed to parse layout.yaml:', error);
    return buildEmptyLayout();
  }
}

export async function loadClustersById(ids: Set<string>): Promise<Map<string, Cluster>> {
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

export async function loadFeaturesById(ids: Set<string>): Promise<Map<string, Feature>> {
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

export async function loadClusterYamlSafe(clusterId: string): Promise<Cluster | null> {
  try {
    return await loadClusterYaml(clusterId);
  } catch (error) {
    console.warn(`Failed to load cluster ${clusterId}:`, error);
    return null;
  }
}

export async function loadFeatureYamlSafe(featureId: string): Promise<Feature | null> {
  try {
    return await loadFeatureYaml(featureId);
  } catch (error) {
    console.warn(`Failed to load feature ${featureId}:`, error);
    return null;
  }
}

function buildEmptyLayout(): Layout {
  return {
    version: 1,
    positions: {},
    metadata: {
      updatedAt: new Date().toISOString(),
    },
  };
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
