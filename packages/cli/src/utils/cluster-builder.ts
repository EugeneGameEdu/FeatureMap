import { createHash } from 'crypto';
import type { DependencyGraph } from '../analyzer/graph.js';
import type { Cluster as FolderCluster } from '../analyzer/grouper.js';
import {
  type Cluster as ClusterFile,
  type ExportSymbol,
  type ImportList,
  type Layer,
  type Metadata,
} from '../types/index.js';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';

interface ClusterBuildOptions {
  metadata: Metadata;
  version?: number;
  purpose_hint?: string;
  entry_points?: string[];
}

export function buildClusterFile(
  cluster: FolderCluster,
  graph: DependencyGraph,
  options: ClusterBuildOptions
): ClusterFile {
  const detection = detectClusterLayer(cluster);

  return {
    version: options.version ?? SUPPORTED_VERSIONS.cluster,
    id: cluster.id,
    layer: detection.layer,
    layerDetection: detection.layerDetection,
    files: cluster.files,
    exports: collectClusterExports(cluster, graph),
    imports: collectClusterImports(cluster, graph),
    purpose_hint: options.purpose_hint,
    entry_points: options.entry_points,
    compositionHash: createCompositionHash(cluster.files),
    metadata: options.metadata,
  };
}

function detectClusterLayer(
  cluster: FolderCluster
): { layer: Layer; layerDetection?: { confidence: 'high' | 'medium' | 'low'; signals: string[] } } {
  const signals: string[] = [];

  if (cluster.id.startsWith('web-')) {
    signals.push('cluster id starts with web-');
    return { layer: 'frontend', layerDetection: { confidence: 'high', signals } };
  }

  if (cluster.id.startsWith('mcp-server')) {
    signals.push('cluster id starts with mcp-server');
    return { layer: 'backend', layerDetection: { confidence: 'high', signals } };
  }

  if (cluster.id.startsWith('cli-')) {
    signals.push('cluster id starts with cli-');
    return { layer: 'infrastructure', layerDetection: { confidence: 'medium', signals } };
  }

  return { layer: 'shared' };
}

function collectClusterExports(
  cluster: FolderCluster,
  graph: DependencyGraph
): ExportSymbol[] {
  const exports: ExportSymbol[] = [];
  const seen = new Set<string>();

  for (const filePath of cluster.files) {
    const file = graph.files[filePath];
    if (!file) {
      continue;
    }

    for (const entry of file.exports) {
      const key = `${entry.name}|${entry.type}|${entry.isDefault ?? false}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      exports.push(entry);
    }
  }

  exports.sort((left, right) => {
    const leftKey = `${left.name}|${left.type}|${left.isDefault ?? false}`;
    const rightKey = `${right.name}|${right.type}|${right.isDefault ?? false}`;
    return leftKey.localeCompare(rightKey);
  });

  return exports;
}

function collectClusterImports(
  cluster: FolderCluster,
  graph: DependencyGraph
): ImportList {
  const internal = new Set<string>();
  const external = new Set<string>();

  for (const filePath of cluster.files) {
    const file = graph.files[filePath];
    if (!file) {
      continue;
    }

    for (const entry of file.imports.internal) {
      internal.add(entry);
    }
    for (const entry of file.imports.external) {
      external.add(entry);
    }
  }

  return {
    internal: [...internal].sort((a, b) => a.localeCompare(b)),
    external: [...external].sort((a, b) => a.localeCompare(b)),
  };
}

function createCompositionHash(values: string[]): string {
  return createHash('sha256').update([...values].sort().join('|')).digest('hex');
}
