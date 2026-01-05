import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse, stringify } from 'yaml';
import type { ClusterInfo, FeatureFile, GraphData, GraphEdge, GraphNode } from '../types/feature.js';
import { normalizeStringList } from './listUtils.js';

const FEATURE_NODE_TYPE = 'feature';
const FEATURE_DEP_EDGE_TYPE = 'feature_dep';
const FEATURE_CONTAINS_EDGE_TYPE = 'contains';

export function readExistingGraphYaml(featuremapDir: string): GraphData | null {
  const graphPath = join(featuremapDir, 'graph.yaml');
  if (!existsSync(graphPath)) {
    return null;
  }

  try {
    const parsed = parse(readFileSync(graphPath, 'utf-8')) as Record<string, unknown>;
    return coerceGraph(parsed);
  } catch {
    return null;
  }
}

export function buildFeatureOverlay(
  features: FeatureFile[],
  clusters: Map<string, ClusterInfo>,
  warnings: string[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const sorted = [...features].sort((a, b) => a.id.localeCompare(b.id));
  const featureIds = new Set(sorted.map((feature) => feature.id));

  const nodes: GraphNode[] = sorted.map((feature) => ({
    id: feature.id,
    label: feature.name,
    type: FEATURE_NODE_TYPE,
    fileCount: computeFileCount(feature, clusters),
  }));

  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  for (const feature of sorted) {
    const deps = normalizeStringList(feature.dependsOn);
    for (const dep of deps) {
      const edge = { source: feature.id, target: dep, type: FEATURE_DEP_EDGE_TYPE };
      const key = edgeKey(edge);
      if (!key || edgeSet.has(key)) {
        continue;
      }
      edgeSet.add(key);
      edges.push(edge);
      if (!featureIds.has(dep)) {
        warnings.push(`Feature "${feature.id}" depends on missing feature "${dep}".`);
      }
    }

    const clusterIds = normalizeStringList(feature.clusters);
    for (const clusterId of clusterIds) {
      const edge = { source: feature.id, target: clusterId, type: FEATURE_CONTAINS_EDGE_TYPE };
      const key = edgeKey(edge);
      if (!key || edgeSet.has(key)) {
        continue;
      }
      edgeSet.add(key);
      edges.push(edge);
    }
  }

  return {
    nodes: dedupeAndSortNodes(nodes),
    edges: dedupeAndSortEdges(edges),
  };
}

export function mergeGraphs(
  existing: GraphData | null,
  overlay: { nodes: GraphNode[]; edges: GraphEdge[] },
  now: string
): GraphData {
  if (!existing) {
    return {
      version: 1,
      generatedAt: now,
      nodes: dedupeAndSortNodes(overlay.nodes),
      edges: dedupeAndSortEdges(overlay.edges),
    };
  }

  const preservedNodes = existing.nodes.filter((node) => getNodeType(node) !== FEATURE_NODE_TYPE);
  const preservedEdges = existing.edges.filter((edge) => !isFeatureEdge(edge));

  return {
    version: existing.version ?? 1,
    generatedAt: now,
    nodes: dedupeAndSortNodes([...preservedNodes, ...overlay.nodes]),
    edges: dedupeAndSortEdges([...preservedEdges, ...overlay.edges]),
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

function coerceGraph(parsed: Record<string, unknown>): GraphData | null {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const nodes = Array.isArray(parsed.nodes) ? (parsed.nodes as GraphNode[]) : [];
  const edges = Array.isArray(parsed.edges) ? (parsed.edges as GraphEdge[]) : [];
  const version = typeof parsed.version === 'number' ? parsed.version : 1;
  const generatedAt = typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '';

  return {
    version,
    generatedAt,
    nodes,
    edges,
  };
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
  return {
    version: graph.version,
    nodes: dedupeAndSortNodes(graph.nodes),
    edges: dedupeAndSortEdges(graph.edges),
  };
}

function normalizeGraphOutput(graph: GraphData): Record<string, unknown> {
  return {
    version: graph.version,
    generatedAt: graph.generatedAt,
    nodes: dedupeAndSortNodes(graph.nodes),
    edges: dedupeAndSortEdges(graph.edges),
  };
}

function dedupeAndSortNodes(nodes: GraphNode[]): GraphNode[] {
  const entries = new Map<string, GraphNode>();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string') {
      continue;
    }
    const key = nodeKey(node);
    if (!key) {
      continue;
    }
    entries.set(key, node);
  }

  return [...entries.values()].sort((a, b) => {
    const typeA = getNodeType(a);
    const typeB = getNodeType(b);
    if (typeA !== typeB) return typeA.localeCompare(typeB);
    return a.id.localeCompare(b.id);
  });
}

function dedupeAndSortEdges(edges: GraphEdge[]): GraphEdge[] {
  const entries = new Map<string, GraphEdge>();
  for (const edge of edges) {
    if (!edge || typeof edge.source !== 'string' || typeof edge.target !== 'string') {
      continue;
    }
    const key = edgeKey(edge);
    if (!key) {
      continue;
    }
    entries.set(key, edge);
  }

  return [...entries.values()].sort((a, b) => {
    const typeA = getEdgeType(a);
    const typeB = getEdgeType(b);
    if (typeA !== typeB) return typeA.localeCompare(typeB);
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.target.localeCompare(b.target);
  });
}

function getNodeType(node: GraphNode): string {
  return typeof node.type === 'string' ? node.type : '';
}

function getEdgeType(edge: GraphEdge): string {
  return typeof edge.type === 'string' ? edge.type : '';
}

function nodeKey(node: GraphNode): string | null {
  if (!node.id) {
    return null;
  }
  return `${getNodeType(node)}::${node.id}`;
}

function edgeKey(edge: GraphEdge): string | null {
  if (!edge.source || !edge.target) {
    return null;
  }
  return `${getEdgeType(edge)}::${edge.source}::${edge.target}`;
}

function isFeatureEdge(edge: GraphEdge): boolean {
  const type = getEdgeType(edge);
  return type === FEATURE_DEP_EDGE_TYPE || type === FEATURE_CONTAINS_EDGE_TYPE;
}

function computeFileCount(feature: FeatureFile, clusters: Map<string, ClusterInfo>): number {
  const clusterIds = normalizeStringList(feature.clusters);
  return clusterIds.reduce((total, id) => total + (clusters.get(id)?.files.length ?? 0), 0);
}
