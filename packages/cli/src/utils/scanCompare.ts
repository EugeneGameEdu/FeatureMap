import { Cluster, Feature, Graph, Metadata } from '../types/index.js';

export function buildUpdatedMetadata(current: Metadata | undefined): Metadata {
  const now = new Date().toISOString();
  if (!current) {
    return {
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    ...current,
    updatedAt: now,
  };
}

export function areClustersEquivalent(left: Cluster, right: Cluster): boolean {
  return deepEqual(
    normalizeClusterForComparison(left),
    normalizeClusterForComparison(right)
  );
}

export function areFeaturesEquivalent(left: Feature, right: Feature): boolean {
  return deepEqual(
    normalizeFeatureForComparison(left),
    normalizeFeatureForComparison(right)
  );
}

export function areGraphsEquivalent(left: Graph, right: Graph): boolean {
  return deepEqual(
    normalizeGraphForComparison(left),
    normalizeGraphForComparison(right)
  );
}

function normalizeFeatureForComparison(feature: Feature): Omit<Feature, 'metadata'> {
  const { metadata, ...rest } = feature;
  const normalized: Omit<Feature, 'metadata'> = { ...rest };

  normalized.clusters = [...normalized.clusters].sort((a, b) => a.localeCompare(b));

  if (normalized.dependsOn) {
    normalized.dependsOn = [...normalized.dependsOn].sort((a, b) => a.localeCompare(b));
  }

  return normalized;
}

function normalizeClusterForComparison(cluster: Cluster): Omit<Cluster, 'metadata'> {
  const { metadata, ...rest } = cluster;
  const normalized: Omit<Cluster, 'metadata'> = { ...rest };

  normalized.files = [...normalized.files].sort((a, b) => a.localeCompare(b));
  normalized.exports = [...normalized.exports].sort((a, b) => {
    const leftKey = `${a.name}-${a.type}-${a.isDefault ?? false}`;
    const rightKey = `${b.name}-${b.type}-${b.isDefault ?? false}`;
    return leftKey.localeCompare(rightKey);
  });
  normalized.imports = {
    internal: [...normalized.imports.internal].sort((a, b) => a.localeCompare(b)),
    external: [...normalized.imports.external].sort((a, b) => a.localeCompare(b)),
  };

  if (normalized.entry_points) {
    normalized.entry_points = [...normalized.entry_points].sort((a, b) => a.localeCompare(b));
  }

  return normalized;
}

function normalizeGraphForComparison(graph: Graph): Omit<Graph, 'generatedAt'> {
  const { generatedAt, ...rest } = graph;
  const normalized: Omit<Graph, 'generatedAt'> = { ...rest };

  normalized.nodes = [...normalized.nodes].sort((a, b) => a.id.localeCompare(b.id));
  normalized.edges = [...normalized.edges].sort((a, b) => {
    const leftKey = `${a.source}->${a.target}`;
    const rightKey = `${b.source}->${b.target}`;
    return leftKey.localeCompare(rightKey);
  });

  return normalized;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (left === null || right === null) {
    return left === right;
  }

  if (Array.isArray(left)) {
    if (!Array.isArray(right)) {
      return false;
    }

    if (left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => deepEqual(value, right[index]));
  }

  if (typeof left === 'object') {
    if (typeof right !== 'object') {
      return false;
    }

    const leftKeys = Object.keys(left as Record<string, unknown>).sort();
    const rightKeys = Object.keys(right as Record<string, unknown>).sort();

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (let index = 0; index < leftKeys.length; index += 1) {
      const key = leftKeys[index];
      if (key !== rightKeys[index]) {
        return false;
      }

      const leftValue = (left as Record<string, unknown>)[key];
      const rightValue = (right as Record<string, unknown>)[key];
      if (!deepEqual(leftValue, rightValue)) {
        return false;
      }
    }

    return true;
  }

  return false;
}
