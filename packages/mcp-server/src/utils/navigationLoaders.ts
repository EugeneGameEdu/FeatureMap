import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import type { FeatureFile } from '../types/feature.js';
import type { GroupFile } from '../types/group.js';
import { loadFeatures as loadFeatureFiles } from './featureLoader.js';
import { loadGroups as loadGroupFiles } from './groupYaml.js';
import { normalizeStringList } from './listUtils.js';

export interface RawCluster {
  id?: string;
  layer?: string;
  layerDetection?: unknown;
  purpose_hint?: string;
  entry_points?: string[];
  imports?: { external?: string[] };
  exports?: unknown[];
  files?: string[];
  compositionHash?: string;
}

export type DerivedLayer =
  | 'frontend'
  | 'backend'
  | 'shared'
  | 'infrastructure'
  | 'fullstack'
  | 'smell';

const LAYER_ORDER: DerivedLayer[] = [
  'frontend',
  'backend',
  'fullstack',
  'shared',
  'infrastructure',
  'smell',
];

export interface NavigationIndices {
  featuresById: Map<string, FeatureFile>;
  clustersById: Map<string, RawCluster>;
  groupsById: Map<string, GroupFile>;
  groupIdsByFeatureId: Map<string, string[]>;
}

export function loadFeatures(featuremapDir: string): Map<string, FeatureFile> {
  return loadFeatureFiles(join(featuremapDir, 'features'));
}

export function loadClusters(featuremapDir: string): RawCluster[] {
  const clustersDir = join(featuremapDir, 'clusters');
  if (!existsSync(clustersDir)) {
    return [];
  }

  const files = readdirSync(clustersDir).filter((file) => file.endsWith('.yaml'));
  const clusters: RawCluster[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(clustersDir, file), 'utf-8');
      const parsed = parse(content) as RawCluster;
      if (parsed?.id && parsed?.layer) {
        clusters.push(parsed);
      }
    } catch {
      // Skip invalid cluster files.
    }
  }

  return clusters;
}

export function loadGroups(featuremapDir: string): Map<string, GroupFile> {
  return loadGroupFiles(featuremapDir);
}

export function buildIndices(featuremapDir: string): NavigationIndices {
  const featuresById = loadFeatures(featuremapDir);
  const clusters = loadClusters(featuremapDir);
  const groupsById = loadGroups(featuremapDir);
  const clustersById = new Map<string, RawCluster>();

  for (const cluster of clusters) {
    if (!cluster.id) {
      continue;
    }
    clustersById.set(cluster.id, cluster);
  }

  const groupIdsByFeatureId = buildGroupIdsByFeatureId(groupsById);

  return {
    featuresById,
    clustersById,
    groupsById,
    groupIdsByFeatureId,
  };
}

export function deriveFeatureLayers(
  feature: FeatureFile,
  clustersById: Map<string, RawCluster>
): DerivedLayer[] {
  const layers = new Set<DerivedLayer>();
  const clusterIds = normalizeStringList(feature.clusters);

  for (const clusterId of clusterIds) {
    const cluster = clustersById.get(clusterId);
    const normalized = normalizeLayerValue(cluster?.layer);
    if (normalized) {
      layers.add(normalized);
    }
  }

  if (layers.size === 0) {
    const fallback = deriveLayersFromScope(feature.scope);
    for (const layer of fallback) {
      layers.add(layer);
    }
  }

  return sortLayers(layers);
}

function buildGroupIdsByFeatureId(groupsById: Map<string, GroupFile>): Map<string, string[]> {
  const groupIdsByFeatureId = new Map<string, string[]>();

  for (const group of groupsById.values()) {
    const featureIds = normalizeStringList(group.featureIds);
    for (const featureId of featureIds) {
      const existing = groupIdsByFeatureId.get(featureId) ?? [];
      existing.push(group.id);
      groupIdsByFeatureId.set(featureId, existing);
    }
  }

  for (const [featureId, groupIds] of groupIdsByFeatureId.entries()) {
    groupIdsByFeatureId.set(featureId, normalizeStringList(groupIds));
  }

  return groupIdsByFeatureId;
}

function normalizeLayerValue(layer?: string | null): DerivedLayer | null {
  if (!layer) {
    return null;
  }
  const normalized = layer.toLowerCase();
  if (normalized === 'frontend') return 'frontend';
  if (normalized === 'backend') return 'backend';
  if (normalized === 'shared') return 'shared';
  if (normalized === 'fullstack' || normalized === 'full-stack') return 'fullstack';
  if (normalized === 'smell') return 'smell';
  if (normalized === 'infrastructure' || normalized === 'infra') return 'infrastructure';
  return null;
}

function deriveLayersFromScope(scope?: string | null): DerivedLayer[] {
  const normalized = scope?.toLowerCase();
  if (normalized === 'frontend') return ['frontend'];
  if (normalized === 'backend') return ['backend'];
  if (normalized === 'shared') return ['shared'];
  if (normalized === 'fullstack' || normalized === 'full-stack') return ['fullstack'];
  return [];
}

function sortLayers(layers: Set<DerivedLayer>): DerivedLayer[] {
  const order = new Map<DerivedLayer, number>(LAYER_ORDER.map((layer, index) => [layer, index]));
  return [...layers].sort((left, right) => {
    const leftRank = order.get(left) ?? 99;
    const rightRank = order.get(right) ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.localeCompare(right);
  });
}
