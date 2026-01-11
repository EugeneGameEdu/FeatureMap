import * as fs from 'fs';
import * as path from 'path';
import type { DependencyGraph } from '../analyzer/graph.js';
import type { Cluster as FolderCluster } from '../analyzer/grouper.js';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import type { EdgeImportDetail, Graph } from '../types/index.js';
import { GraphSchema } from '../types/index.js';
import { areGraphsEquivalent } from './scanCompare.js';
import { loadYAML, saveYAML } from './yaml-loader.js';

export function saveGraphYaml(
  featuremapDir: string,
  clusters: FolderCluster[],
  graph: DependencyGraph
): void {
  const nodes: Graph['nodes'] = clusters.map((cluster) => ({
    id: cluster.id,
    label: cluster.name,
    type: 'cluster',
    fileCount: cluster.files.length,
  }));

  const edges: Graph['edges'] = [];
  const clusterById = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  const fileToCluster = buildFileToCluster(clusters);
  const graphFiles = new Set(Object.keys(graph.files));

  for (const cluster of clusters) {
    for (const dep of cluster.externalDependencies) {
      const edge: Graph['edges'][number] = { source: cluster.id, target: dep };
      const targetCluster = clusterById.get(dep);
      if (targetCluster) {
        const imports = buildEdgeImports(
          cluster,
          targetCluster,
          graph,
          fileToCluster,
          graphFiles
        );
        if (imports.length > 0) {
          edge.imports = imports;
        }
      }
      edges.push(edge);
    }
  }

  const filePath = path.join(featuremapDir, 'graph.yaml');
  if (fs.existsSync(filePath)) {
    try {
      const existing = loadYAML(filePath, GraphSchema, { fileType: 'graph' });
      const nextGraph = buildGraphData(nodes, edges, existing.version);

      if (areGraphsEquivalent(existing, nextGraph)) {
        return;
      }
    } catch {
      // Fall through to regenerate graph with the latest schema.
    }
  }

  const graphYaml = buildGraphData(nodes, edges, SUPPORTED_VERSIONS.graph);
  saveYAML(filePath, graphYaml, GraphSchema, {
    sortArrayFields: ['nodes', 'edges'],
  });
}

function buildGraphData(nodes: Graph['nodes'], edges: Graph['edges'], version: number): Graph {
  return {
    version,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
  };
}

function buildFileToCluster(clusters: FolderCluster[]): Record<string, string> {
  const fileToCluster: Record<string, string> = {};
  for (const cluster of clusters) {
    for (const file of cluster.files) {
      fileToCluster[file] = cluster.id;
    }
  }
  return fileToCluster;
}

function buildEdgeImports(
  sourceCluster: FolderCluster,
  targetCluster: FolderCluster,
  graph: DependencyGraph,
  fileToCluster: Record<string, string>,
  graphFiles: Set<string>
): EdgeImportDetail[] {
  const details = new Map<string, EdgeImportDetail>();

  for (const sourceFile of sourceCluster.files) {
    const fileNode = graph.files[sourceFile];
    const importDetails = fileNode?.imports.internalDetails;
    if (!fileNode || !importDetails || importDetails.length === 0) {
      continue;
    }

    const dependencies = new Set(graph.dependencies[sourceFile] ?? []);

    for (const detail of importDetails) {
      const resolvedTarget = resolveImportPath(detail.from, sourceFile, graphFiles);
      if (!resolvedTarget) {
        continue;
      }
      if (!dependencies.has(resolvedTarget)) {
        continue;
      }
      if (fileToCluster[resolvedTarget] !== targetCluster.id) {
        continue;
      }

      for (const symbol of detail.symbols) {
        const key = `${symbol}|${resolvedTarget}`;
        let entry = details.get(key);
        if (!entry) {
          entry = {
            symbol,
            sourceFiles: [],
            targetFile: resolvedTarget,
          };
          details.set(key, entry);
        }
        if (!entry.sourceFiles.includes(sourceFile)) {
          entry.sourceFiles.push(sourceFile);
        }
      }
    }
  }

  const sortedDetails = Array.from(details.values()).map((detail) => ({
    ...detail,
    sourceFiles: [...new Set(detail.sourceFiles)].sort((a, b) => a.localeCompare(b)),
  }));
  sortedDetails.sort((left, right) => {
    const symbolCompare = left.symbol.localeCompare(right.symbol);
    if (symbolCompare !== 0) {
      return symbolCompare;
    }
    return (left.targetFile ?? '').localeCompare(right.targetFile ?? '');
  });

  return sortedDetails;
}

function resolveImportPath(
  importPath: string,
  fromFile: string,
  graphFiles: Set<string>
): string | null {
  if (graphFiles.has(importPath)) {
    return importPath;
  }
  if (!importPath.startsWith('.')) {
    return null;
  }

  const fromDir = path.posix.dirname(fromFile);
  const resolved = path.posix.normalize(path.posix.join(fromDir, importPath));

  const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
  const variants = [resolved, `${resolved}/index`];

  for (const variant of variants) {
    for (const ext of extensions) {
      const candidate = `${variant}${ext}`;
      if (graphFiles.has(candidate)) {
        return candidate;
      }
    }
  }

  const withoutExt = resolved.replace(/\.(js|jsx)$/, '');
  for (const ext of ['.ts', '.tsx']) {
    const candidate = `${withoutExt}${ext}`;
    if (graphFiles.has(candidate)) {
      return candidate;
    }
  }

  return null;
}
