export interface ClusterMatchResult {
  matchedId: string | null;
  confidence: number;
  reason: string;
}

export interface ExistingCluster {
  id: string;
  files: string[];
  compositionHash: string;
}

export interface NewClusterCandidate {
  suggestedId: string;
  files: string[];
}

/**
 * Match a new cluster candidate to existing clusters based on file overlap.
 * Returns the best matching existing cluster ID, or null if no good match.
 */
export function matchCluster(
  candidate: NewClusterCandidate,
  existingClusters: ExistingCluster[],
  options?: { minOverlapThreshold?: number }
): ClusterMatchResult {
  const threshold = options?.minOverlapThreshold ?? 0.7;

  let bestMatch: ExistingCluster | null = null;
  let bestOverlap = 0;

  for (const existing of existingClusters) {
    const overlap = calculateFileOverlap(candidate.files, existing.files);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = existing;
    }
  }

  if (bestMatch && bestOverlap >= threshold) {
    return {
      matchedId: bestMatch.id,
      confidence: bestOverlap,
      reason: `overlap ${Math.round(bestOverlap * 100)}%`,
    };
  }

  const reason = bestMatch
    ? `best overlap ${Math.round(bestOverlap * 100)}% below threshold`
    : 'no existing clusters to match';

  return {
    matchedId: null,
    confidence: bestOverlap,
    reason,
  };
}

/**
 * Calculate Jaccard similarity between two file sets.
 * Returns 0-1 (0 = no overlap, 1 = identical)
 */
export function calculateFileOverlap(filesA: string[], filesB: string[]): number {
  const setA = new Set(filesA);
  const setB = new Set(filesB);

  let intersection = 0;
  for (const entry of setA) {
    if (setB.has(entry)) {
      intersection += 1;
    }
  }

  const union = new Set([...setA, ...setB]).size;

  return union === 0 ? 0 : intersection / union;
}
