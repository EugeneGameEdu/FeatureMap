import { writeFileSync } from 'fs';
import { stringify } from 'yaml';
import type { FeatureFile, FeatureLocks, FeatureMetadata } from '../types/feature.js';
import { normalizeStringList } from './listUtils.js';

export function writeFeatureYaml(filePath: string, feature: FeatureFile): void {
  const normalized = normalizeFeatureOutput(feature);
  const content = stringify(normalized, { lineWidth: 0 });
  writeFileSync(filePath, content, 'utf-8');
}

function normalizeFeatureOutput(feature: FeatureFile): Record<string, unknown> {
  const clusters = normalizeStringList(feature.clusters);
  const dependsOn = normalizeStringList(feature.dependsOn);
  const locks = normalizeLocks(feature.locks);
  const metadata = normalizeMetadata(feature.metadata);

  return {
    version: feature.version,
    id: feature.id,
    name: feature.name,
    ...(feature.description !== undefined ? { description: feature.description } : {}),
    ...(feature.purpose !== undefined ? { purpose: feature.purpose } : {}),
    source: feature.source,
    status: feature.status,
    scope: feature.scope,
    clusters,
    ...(dependsOn.length > 0 ? { dependsOn } : {}),
    composition: { hash: feature.composition.hash },
    ...(locks ? { locks } : {}),
    metadata,
    ...(feature.reasoning !== undefined ? { reasoning: feature.reasoning } : {}),
  };
}

function normalizeLocks(locks?: FeatureLocks): FeatureLocks | undefined {
  if (!locks) {
    return undefined;
  }

  const normalized: FeatureLocks = {};
  if (locks.name !== undefined) normalized.name = locks.name;
  if (locks.description !== undefined) normalized.description = locks.description;
  if (locks.clusters !== undefined) normalized.clusters = locks.clusters;
  if (locks.scope !== undefined) normalized.scope = locks.scope;
  if (locks.dependsOn !== undefined) normalized.dependsOn = locks.dependsOn;
  if (locks.status !== undefined) normalized.status = locks.status;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeMetadata(metadata: FeatureMetadata): FeatureMetadata {
  const normalized: FeatureMetadata = {
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };

  if (metadata.lastModifiedBy !== undefined) {
    normalized.lastModifiedBy = metadata.lastModifiedBy;
  }
  if (metadata.version !== undefined) {
    normalized.version = metadata.version;
  }

  return normalized;
}
