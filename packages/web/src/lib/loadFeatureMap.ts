import yaml from 'js-yaml';
import type { GraphData, Feature, FeatureMapData } from './types';

const DATA_BASE_URL = '/featuremap-data';

export async function loadFeatureMap(): Promise<FeatureMapData> {
  const graph = await loadGraphYaml();

  const features: Record<string, Feature> = {};

  for (const node of graph.nodes) {
    try {
      const feature = await loadFeatureYaml(node.id);
      features[node.id] = feature;
    } catch (error) {
      console.warn(`Failed to load feature ${node.id}:`, error);
    }
  }

  return { graph, features };
}

async function loadGraphYaml(): Promise<GraphData> {
  const response = await fetch(`${DATA_BASE_URL}/graph.yaml`);

  if (!response.ok) {
    throw new Error(`Failed to load graph.yaml: ${response.statusText}`);
  }

  const text = await response.text();
  return yaml.load(text) as GraphData;
}

async function loadFeatureYaml(featureId: string): Promise<Feature> {
  const response = await fetch(`${DATA_BASE_URL}/features/${featureId}.yaml`);

  if (!response.ok) {
    throw new Error(`Failed to load feature ${featureId}: ${response.statusText}`);
  }

  const text = await response.text();
  return yaml.load(text) as Feature;
}

// Утилита для форматирования даты
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
