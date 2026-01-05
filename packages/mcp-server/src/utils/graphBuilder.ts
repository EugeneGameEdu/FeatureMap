import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse, stringify } from 'yaml';
import type { ClusterInfo, FeatureFile, GraphData, GraphEdge, GraphNode } from '../types/feature.js';
import { normalizeStringList } from './listUtils.js';

export function buildGraphData(
  features: FeatureFile[],
  clusters: Map<string, ClusterInfo>,
  warnings: string[],
  now: string
): GraphData {
  const sorted = [...features].sort((a, b) => a.id.localeCompare(b.id));
  const featureIds = new Set(sorted.map((feature) => feature.id));

  const nodes: GraphNode[] = sorted.map((feature) => ({
    id: feature.id,
    label: feature.name,
    type: 'feature',
    fileCount: computeFileCount(feature, clusters),
  }));

  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  for (const feature of sorted) {
    const deps = normalizeStringList(feature.dependsOn);
    for (const dep of deps) {
      const key = `${feature.id}->${dep}`;
      if (edgeSet.has(key)) {
        continue;
      }
      edgeSet.add(key);
      edges.push({ source: feature.id, target: dep });
      if (!featureIds.has(dep)) {
        warnings.push(`Feature "${feature.id}" depends on missing feature "${dep}".`);
      }
    }
  }

  edges.sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.target.localeCompare(b.target);
  });

  return {
    version: 1,
    generatedAt: now,
    nodes,
    edges,
  };
}

export function writeGraphYaml(featuremapDir: string, graph: GraphData): boolean {
  const graphPath = join(featuremapDir, 'graph.yaml');
  if (existsSync(graphPath)) {
    try {
      const existing = parse(readFileSync(graphPath, 'utf-8')) as GraphData;
      if (existing && graphsEquivalent(existing, graph)) {
        return false;
      }
    } catch {
      // Fall through to regenerate.
    }
  }

  const content = stringify(normalizeGraphOutput(graph), { lineWidth: 0 });
  writeFileSync(graphPath, content, 'utf-8');
  return true;
}

function graphsEquivalent(existing: GraphData, next: GraphData): boolean {
  const normalizedExisting = normalizeGraphForComparison(existing);
  const normalizedNext = normalizeGraphForComparison(next);
  return JSON.stringify(normalizedExisting) === JSON.stringify(normalizedNext);
}

function normalizeGraphForComparison(graph: GraphData): {
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const nodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...graph.edges].sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.target.localeCompare(b.target);
  });

  return {
    version: graph.version,
    nodes,
    edges,
  };
}

function normalizeGraphOutput(graph: GraphData): Record<string, unknown> {
  const nodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...graph.edges].sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.target.localeCompare(b.target);
  });

  return {
    version: graph.version,
    generatedAt: graph.generatedAt,
    nodes: nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      fileCount: node.fileCount,
    })),
    edges: edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    })),
  };
}

function computeFileCount(feature: FeatureFile, clusters: Map<string, ClusterInfo>): number {
  const clusterIds = normalizeStringList(feature.clusters);
  return clusterIds.reduce((total, id) => total + (clusters.get(id)?.files.length ?? 0), 0);
}
