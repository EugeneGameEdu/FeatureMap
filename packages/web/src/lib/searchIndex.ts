import type { FeatureMapData, Layer } from './types';

export type SearchResultType = 'feature' | 'cluster' | 'file';

export interface SearchIndexEntry {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  fields: string[];
  prefixFields: string[];
  tokenSet: Set<string>;
  metadata: {
    layer?: Layer;
    layers?: Layer[];
    groupIds?: string[];
    groupNames?: string[];
    clusterId?: string;
    featureIds?: string[];
    featureNames?: string[];
    filePath?: string;
    fileName?: string;
  };
}

export function buildSearchIndex(data: FeatureMapData): SearchIndexEntry[] {
  const groupNamesByFeatureId = new Map<string, string[]>();
  const groupIdsByFeatureId = new Map<string, string[]>();

  for (const group of data.groups) {
    for (const featureId of group.featureIds) {
      const names = groupNamesByFeatureId.get(featureId) ?? [];
      names.push(group.name);
      groupNamesByFeatureId.set(featureId, names);

      const ids = groupIdsByFeatureId.get(featureId) ?? [];
      ids.push(group.id);
      groupIdsByFeatureId.set(featureId, ids);
    }
  }

  const featureLayersById = new Map<string, Layer[]>();
  for (const node of data.featureGraph.nodes) {
    if (node.layers && node.layers.length > 0) {
      featureLayersById.set(node.id, node.layers);
    }
  }

  const featureIdsByClusterId = new Map<string, string[]>();
  const featureNamesById = new Map<string, string>();

  for (const [id, entity] of Object.entries(data.entities)) {
    if (entity.kind !== 'feature') {
      continue;
    }
    featureNamesById.set(id, entity.data.name);
    for (const clusterId of entity.data.clusters) {
      const ids = featureIdsByClusterId.get(clusterId) ?? [];
      ids.push(id);
      featureIdsByClusterId.set(clusterId, ids);
    }
  }

  const entries: SearchIndexEntry[] = [];

  for (const [id, entity] of Object.entries(data.entities)) {
    if (entity.kind === 'feature') {
      const groupNames = groupNamesByFeatureId.get(id) ?? [];
      const groupIds = groupIdsByFeatureId.get(id) ?? [];
      const layers = featureLayersById.get(id) ?? [];
      const subtitle = formatFeatureSubtitle(id, groupNames, layers);
      entries.push(
        createEntry({
          type: 'feature',
          id,
          title: entity.data.name,
          subtitle,
          fields: [
            id,
            entity.data.name,
            entity.data.description,
            entity.data.purpose,
            ...groupNames,
            ...groupIds,
            ...layers,
          ],
          prefixFields: [id, entity.data.name],
          metadata: {
            groupIds,
            groupNames,
            layers,
          },
        })
      );
      continue;
    }

    const cluster = entity.data;
    const subtitle = formatClusterSubtitle(cluster.layer, cluster.purpose_hint);
    entries.push(
      createEntry({
        type: 'cluster',
        id,
        title: entity.label,
        subtitle,
        fields: [cluster.id, entity.label, cluster.layer, cluster.purpose_hint],
        prefixFields: [cluster.id, entity.label],
        metadata: { layer: cluster.layer },
      })
    );

    const featureIds = featureIdsByClusterId.get(cluster.id) ?? [];
    const featureNames = featureIds
      .map((featureId) => featureNamesById.get(featureId))
      .filter((name): name is string => Boolean(name));

    for (const filePath of cluster.files) {
      const fileName = getFileName(filePath);
      const fileSubtitle = formatFileSubtitle(cluster.id, cluster.layer, featureNames);
      entries.push(
        createEntry({
          type: 'file',
          id: filePath,
          title: fileName,
          subtitle: fileSubtitle,
          fields: [
            filePath,
            fileName,
            cluster.id,
            cluster.layer,
            ...featureIds,
            ...featureNames,
          ],
          prefixFields: [fileName, filePath],
          metadata: {
            clusterId: cluster.id,
            featureIds,
            featureNames,
            filePath,
            fileName,
            layer: cluster.layer,
          },
        })
      );
    }
  }

  return entries;
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[-_/.\\]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function tokenize(value: string): string[] {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized.split(' ') : [];
}

interface EntryInput {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  fields: Array<string | undefined>;
  prefixFields: Array<string | undefined>;
  metadata: SearchIndexEntry['metadata'];
}

function createEntry(input: EntryInput): SearchIndexEntry {
  const fields = compact(input.fields).map(normalizeText).filter(Boolean);
  const prefixFields = compact(input.prefixFields).map(normalizeText).filter(Boolean);
  const tokenSet = new Set<string>();

  for (const field of fields) {
    for (const token of field.split(' ')) {
      if (token) {
        tokenSet.add(token);
      }
    }
  }

  return {
    type: input.type,
    id: input.id,
    title: input.title,
    subtitle: input.subtitle,
    fields,
    prefixFields,
    tokenSet,
    metadata: input.metadata,
  };
}

function formatFeatureSubtitle(
  featureId: string,
  groupNames: string[],
  layers: Layer[]
): string | undefined {
  const parts: string[] = [`ID: ${featureId}`];
  if (groupNames.length > 0) {
    parts.push(`Groups: ${formatListSummary(groupNames)}`);
  }
  if (layers.length > 0) {
    parts.push(`Layers: ${formatListSummary(layers)}`);
  }
  return parts.join(' • ');
}

function formatClusterSubtitle(layer: Layer, purposeHint?: string): string | undefined {
  const parts = [`Layer: ${layer}`];
  if (purposeHint) {
    parts.push(purposeHint);
  }
  return parts.join(' • ');
}

function formatFileSubtitle(
  clusterId: string,
  layer: Layer,
  featureNames: string[]
): string | undefined {
  const parts: string[] = [`Cluster: ${clusterId}`, `Layer: ${layer}`];
  if (featureNames.length > 0) {
    parts.push(`Features: ${formatListSummary(featureNames)}`);
  }
  return parts.join(' • ');
}

function formatListSummary(items: string[], limit = 2): string {
  if (items.length <= limit) {
    return items.join(', ');
  }
  return `${items.slice(0, limit).join(', ')} +${items.length - limit}`;
}

function getFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

function compact(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value && value.trim()));
}
