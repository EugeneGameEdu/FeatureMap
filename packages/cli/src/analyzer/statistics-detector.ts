import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import type { Statistics } from '../types/context.js';

export interface StatisticsDetectionInput {
  totalFiles: number;
  totalDependencies: number;
  clusterCount: number;
  featureCount: number;
}

export function detectStatistics(input: StatisticsDetectionInput): Statistics {
  return {
    version: SUPPORTED_VERSIONS.context,
    source: 'auto',
    detectedAt: new Date().toISOString(),
    counts: {
      files: Math.max(0, input.totalFiles),
      clusters: Math.max(0, input.clusterCount),
      features: Math.max(0, input.featureCount),
      edges: Math.max(0, input.totalDependencies),
    },
  };
}
