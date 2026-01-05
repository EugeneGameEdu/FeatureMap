import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import type { ClusterInfo, FeatureFile } from '../types/feature.js';

export function loadClusters(clustersDir: string): Map<string, ClusterInfo> {
  const clusters = new Map<string, ClusterInfo>();
  if (!existsSync(clustersDir)) {
    return clusters;
  }

  const files = readdirSync(clustersDir).filter((file) => file.endsWith('.yaml'));
  for (const file of files) {
    try {
      const content = readFileSync(join(clustersDir, file), 'utf-8');
      const parsed = parse(content) as Partial<ClusterInfo>;
      if (!parsed?.id) {
        continue;
      }
      clusters.set(parsed.id, {
        id: parsed.id,
        layer: parsed.layer,
        files: Array.isArray(parsed.files) ? parsed.files : [],
        compositionHash: parsed.compositionHash,
      });
    } catch {
      // Skip invalid cluster files.
    }
  }

  return clusters;
}

export function loadFeatures(featuresDir: string): Map<string, FeatureFile> {
  const features = new Map<string, FeatureFile>();
  if (!existsSync(featuresDir)) {
    return features;
  }

  const files = readdirSync(featuresDir).filter((file) => file.endsWith('.yaml'));
  for (const file of files) {
    try {
      const content = readFileSync(join(featuresDir, file), 'utf-8');
      const parsed = parse(content) as FeatureFile;
      if (!parsed?.id) {
        continue;
      }
      features.set(parsed.id, parsed);
    } catch {
      // Skip invalid feature files.
    }
  }

  return features;
}
