import type { DependencyGraph } from '../analyzer/graph.js';
import type { Cluster as FolderCluster } from '../analyzer/grouper.js';
import { detectLayer } from '../analyzer/layer-detector.js';
import { generateCompositionHash } from './composition-hash.js';
import {
  type Cluster as ClusterFile,
  type ExportSymbol,
  type ImportList,
  type Metadata,
} from '../types/index.js';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';

interface ClusterBuildOptions {
  metadata: Metadata;
  version?: number;
  purpose_hint?: string;
  entry_points?: string[];
  existingCluster?: ClusterFile | null;
}

export function buildClusterFile(
  cluster: FolderCluster,
  graph: DependencyGraph,
  options: ClusterBuildOptions
): ClusterFile {
  const exportSymbols = collectClusterExports(cluster, graph);
  const imports = collectClusterImports(cluster, graph);
  const detection = detectLayer({
    files: cluster.files,
    imports,
    exports: exportSymbols,
  });
  const layerLocked = options.existingCluster?.locks?.layer === true;

  return {
    version: options.version ?? SUPPORTED_VERSIONS.cluster,
    id: cluster.id,
    layer: layerLocked ? options.existingCluster?.layer ?? detection.layer : detection.layer,
    layerDetection: detection,
    ...(options.existingCluster?.locks ? { locks: options.existingCluster.locks } : {}),
    files: cluster.files,
    exports: exportSymbols,
    imports,
    ...(options.purpose_hint !== undefined ? { purpose_hint: options.purpose_hint } : {}),
    ...(options.entry_points !== undefined ? { entry_points: options.entry_points } : {}),
    compositionHash: generateCompositionHash(cluster.files),
    metadata: options.metadata,
  };
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
