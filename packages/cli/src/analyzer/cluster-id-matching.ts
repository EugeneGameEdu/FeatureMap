import type { Cluster as FolderCluster } from './grouper.js';
import type { ExistingClusterInfo } from './cluster-loader.js';
import { matchCluster } from './cluster-matcher.js';

export interface ClusterIdMatch {
  suggestedId: string;
  matchedId: string;
  confidence: number;
}

export interface ClusterMatchingResult {
  clusters: FolderCluster[];
  matchedIds: Set<string>;
  matches: ClusterIdMatch[];
  orphaned: ExistingClusterInfo[];
}

export function applyClusterMatching(
  clusters: FolderCluster[],
  existingClusters: ExistingClusterInfo[],
  options?: { minOverlapThreshold?: number }
): ClusterMatchingResult {
  if (existingClusters.length === 0) {
    return {
      clusters,
      matchedIds: new Set<string>(),
      matches: [],
      orphaned: [],
    };
  }

  const candidates = clusters.map((cluster) => {
    const match = matchCluster(
      { suggestedId: cluster.id, files: cluster.files },
      existingClusters,
      options
    );
    return { cluster, match };
  });

  const sortedCandidates = [...candidates].sort((left, right) => {
    if (right.match.confidence !== left.match.confidence) {
      return right.match.confidence - left.match.confidence;
    }

    return left.cluster.id.localeCompare(right.cluster.id);
  });

  const usedIds = new Set<string>();
  const matchedIds = new Set<string>();
  const idMap = new Map<string, string>();
  const matches: ClusterIdMatch[] = [];

  for (const candidate of sortedCandidates) {
    const suggestedId = candidate.cluster.id;
    const matchedId = candidate.match.matchedId;

    let finalId = suggestedId;
    if (matchedId && !usedIds.has(matchedId)) {
      finalId = matchedId;
      matchedIds.add(matchedId);
      if (matchedId !== suggestedId) {
        matches.push({
          suggestedId,
          matchedId,
          confidence: candidate.match.confidence,
        });
      }
    } else {
      finalId = ensureUniqueId(suggestedId, usedIds);
    }

    usedIds.add(finalId);
    idMap.set(suggestedId, finalId);
  }

  const updatedClusters = clusters.map((cluster) => {
    const finalId = idMap.get(cluster.id) ?? cluster.id;
    const updatedDeps = cluster.externalDependencies.map(
      (dependency) => idMap.get(dependency) ?? dependency
    );

    return {
      ...cluster,
      id: finalId,
      name: formatClusterName(finalId),
      externalDependencies: updatedDeps,
    };
  });

  updatedClusters.sort((a, b) => a.id.localeCompare(b.id));

  const finalMatchedIds = new Set(updatedClusters.map((cluster) => cluster.id));
  const orphaned = existingClusters.filter((existing) => !finalMatchedIds.has(existing.id));

  return {
    clusters: updatedClusters,
    matchedIds,
    matches,
    orphaned,
  };
}

function ensureUniqueId(baseId: string, usedIds: Set<string>): string {
  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let counter = 2;
  let candidate = `${baseId}-${counter}`;
  while (usedIds.has(candidate)) {
    counter += 1;
    candidate = `${baseId}-${counter}`;
  }

  return candidate;
}

function formatClusterName(clusterId: string): string {
  return clusterId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// stability-test: noop
