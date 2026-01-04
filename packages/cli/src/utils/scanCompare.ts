import { Feature, Graph } from '../types/index.js';

export function buildUpdatedMetadata(
  current: Feature['metadata'] | undefined
): NonNullable<Feature['metadata']> {
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

function normalizeFeatureForComparison(feature: Feature): Feature {
  const { metadata, ...rest } = feature;
  const normalized: Feature = { ...rest };

  if (normalized.files) {
    normalized.files = [...normalized.files].sort((a, b) => a.path.localeCompare(b.path));
  }

  if (normalized.clusters) {
    normalized.clusters = [...normalized.clusters].sort((a, b) => a.localeCompare(b));
  }

  if (normalized.dependsOn) {
    normalized.dependsOn = [...normalized.dependsOn].sort((a, b) => a.localeCompare(b));
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
