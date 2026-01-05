import { createHash } from 'crypto';
import type {
  ClusterInfo,
  FeatureFile,
  FeatureInput,
  FeatureLocks,
  FeatureMetadata,
  FeatureScope,
} from '../types/feature.js';
import { normalizeStringList } from './listUtils.js';

export function mergeFeatureWithLocks(args: {
  existing?: FeatureFile;
  incoming: FeatureInput;
  clusters: Map<string, ClusterInfo>;
  now: string;
  warnings: string[];
}): { feature: FeatureFile; changed: boolean; isNew: boolean } {
  const { existing, incoming, clusters, now, warnings } = args;
  const locks = existing?.locks;
  const incomingDescription = incoming.description ?? incoming.purpose;

  const name = locks?.name && existing?.name ? existing.name : incoming.name;
  const description =
    locks?.description && existing?.description !== undefined
      ? existing.description
      : incomingDescription ?? existing?.description;
  const clustersList =
    locks?.clusters && Array.isArray(existing?.clusters)
      ? normalizeStringList(existing.clusters)
      : normalizeStringList(incoming.clusters);
  const dependsOnList = resolveDependsOn({ locks, existing, incoming });
  const scope =
    locks?.scope && existing?.scope
      ? existing.scope
      : incoming.scope ?? deriveScopeFromClusters(clustersList, clusters);
  const status = incoming.status ?? existing?.status ?? 'active';
  const reasoning = incoming.reasoning !== undefined ? incoming.reasoning : existing?.reasoning;

  const compositionHash = computeFeatureCompositionHash(clustersList, clusters, warnings);

  const candidate: FeatureFile = {
    version: existing?.version ?? 1,
    id: incoming.id,
    name,
    description,
    purpose: existing?.purpose,
    source: existing?.source ?? 'ai',
    status,
    scope,
    clusters: clustersList,
    dependsOn: dependsOnList.length > 0 ? dependsOnList : undefined,
    composition: { hash: compositionHash },
    locks,
    metadata: existing?.metadata ?? { createdAt: now, updatedAt: now },
    reasoning,
  };

  if (!existing) {
    candidate.metadata = buildMetadata(undefined, now, true, true);
    candidate.source = 'ai';
    return { feature: candidate, changed: true, isNew: true };
  }

  const semanticChanged = !areSignaturesEqual(
    buildSemanticSignature(existing),
    buildSemanticSignature(candidate)
  );
  const contentChanged = !areSignaturesEqual(
    buildContentSignature(existing),
    buildContentSignature(candidate)
  );
  const changed = semanticChanged || contentChanged;

  if (!changed) {
    return { feature: existing, changed: false, isNew: false };
  }

  candidate.metadata = buildMetadata(existing.metadata, now, semanticChanged, false);
  candidate.source = 'ai';
  return { feature: candidate, changed: true, isNew: false };
}

export function markFeatureIgnored(
  existing: FeatureFile,
  now: string
): { feature: FeatureFile; changed: boolean } {
  if (existing.locks?.status) {
    return { feature: existing, changed: false };
  }

  if (existing.status === 'ignored') {
    return { feature: existing, changed: false };
  }

  const updated: FeatureFile = {
    ...existing,
    status: 'ignored',
    source: 'ai',
    metadata: buildMetadata(existing.metadata, now, true, false),
  };
  return { feature: updated, changed: true };
}

function resolveDependsOn(args: {
  locks?: FeatureLocks;
  existing?: FeatureFile;
  incoming: FeatureInput;
}): string[] {
  const { locks, existing, incoming } = args;
  if (locks?.dependsOn) {
    return Array.isArray(existing?.dependsOn) ? normalizeStringList(existing.dependsOn) : [];
  }

  if (incoming.dependsOn !== undefined) {
    return normalizeStringList(incoming.dependsOn);
  }

  if (Array.isArray(existing?.dependsOn)) {
    return normalizeStringList(existing.dependsOn);
  }

  return [];
}

function buildSemanticSignature(feature?: FeatureFile): Record<string, unknown> {
  return {
    name: feature?.name ?? null,
    description: feature?.description ?? null,
    scope: feature?.scope ?? null,
    status: feature?.status ?? null,
    clusters: normalizeStringList(feature?.clusters),
    dependsOn: normalizeStringList(feature?.dependsOn),
    compositionHash: feature?.composition?.hash ?? null,
  };
}

function buildContentSignature(feature?: FeatureFile): Record<string, unknown> {
  return {
    ...buildSemanticSignature(feature),
    reasoning: feature?.reasoning ?? null,
    purpose: feature?.purpose ?? null,
  };
}

function areSignaturesEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildMetadata(
  existing: FeatureMetadata | undefined,
  now: string,
  semanticChanged: boolean,
  isNew: boolean
): FeatureMetadata {
  const createdAt = isNew ? now : existing?.createdAt ?? now;
  const updatedAt = now;
  const version = isNew
    ? 1
    : semanticChanged
      ? (existing?.version ?? 0) + 1
      : existing?.version;

  return {
    createdAt,
    updatedAt,
    lastModifiedBy: 'ai',
    ...(version !== undefined ? { version } : {}),
  };
}

function deriveScopeFromClusters(
  clusterIds: string[],
  clusters: Map<string, ClusterInfo>
): FeatureScope {
  const layers = new Set<string>();
  for (const id of clusterIds) {
    const layer = clusters.get(id)?.layer;
    if (layer) {
      layers.add(layer);
    }
  }

  if (layers.size === 0) {
    return 'shared';
  }

  if (layers.size > 1) {
    return 'fullstack';
  }

  const [layer] = layers;
  if (layer === 'frontend') return 'frontend';
  if (layer === 'backend') return 'backend';
  if (layer === 'shared') return 'shared';

  // Infrastructure clusters support backend concerns by default.
  return 'backend';
}

function computeFeatureCompositionHash(
  clusterIds: string[],
  clusters: Map<string, ClusterInfo>,
  warnings: string[]
): string {
  const parts = clusterIds.map((id) => {
    const cluster = clusters.get(id);
    if (!cluster) {
      warnings.push(`Missing cluster data for "${id}" when computing composition hash.`);
      return `${id}:missing`;
    }

    const signature = cluster.compositionHash
      ? cluster.compositionHash
      : normalizeStringList(cluster.files).join('|');
    return `${id}:${signature}`;
  });

  const base = parts.join('|');
  return createHash('sha256').update(base).digest('hex').slice(0, 16);
}
