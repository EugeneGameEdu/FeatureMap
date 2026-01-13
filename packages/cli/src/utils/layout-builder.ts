import dagre from '@dagrejs/dagre';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import type { Layout } from '../types/layout.js';

type LayoutEdge = { source: string; target: string };
type RankedNode = { id: string; x: number; y: number; rank: number };
type DagreGraph = { node: (id: string) => { x: number; y: number; rank?: number } | undefined };

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const NODE_SEP = 80;
const RANK_SEP = 120;
const FANOUT_SPACING = Math.max(NODE_SEP, NODE_WIDTH * 0.5);
const FANOUT_WEIGHT = 0.65;
const FANOUT_RANGE_THRESHOLD = NODE_WIDTH * 0.75;

export function buildDefaultLayout(nodeIds: string[], edges: LayoutEdge[] = []): Layout {
  const positions: Layout['positions'] = {};
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: NODE_SEP, ranksep: RANK_SEP });

  const uniqueNodeIds = Array.from(new Set(nodeIds)).sort((a, b) => a.localeCompare(b));
  uniqueNodeIds.forEach((id) => {
    dagreGraph.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  const nodeIdSet = new Set(uniqueNodeIds);
  const seenEdges = new Set<string>();
  const normalizedEdges: LayoutEdge[] = [];
  edges.forEach((edge) => {
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) {
      return;
    }
    if (edge.source === edge.target) {
      return;
    }
    const key = `${edge.source}->${edge.target}`;
    if (seenEdges.has(key)) {
      return;
    }
    seenEdges.add(key);
    normalizedEdges.push(edge);
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const totalNodes = uniqueNodeIds.length;
  const rankedNodes = buildRankedNodes(uniqueNodeIds, dagreGraph);
  const edgesBySource = buildEdgesBySource(normalizedEdges);
  const edgesByTarget = buildEdgesByTarget(normalizedEdges);
  const alignedX = alignNodesByDependencies(rankedNodes, edgesBySource, edgesByTarget);
  uniqueNodeIds.forEach((id, index) => {
    const nodeWithPosition = dagreGraph.node(id) as { x: number; y: number } | undefined;
    if (!nodeWithPosition) {
      positions[id] = fallbackPosition(index, totalNodes);
      return;
    }
    const centerX = alignedX.get(id);
    positions[id] = {
      x: (centerX ?? nodeWithPosition.x) - NODE_WIDTH / 2,
      y: nodeWithPosition.y - NODE_HEIGHT / 2,
    };
  });

  return {
    version: SUPPORTED_VERSIONS.layout,
    positions,
    metadata: {
      updatedAt: new Date().toISOString(),
    },
  };
}

function fallbackPosition(index: number, totalNodes: number): { x: number; y: number } {
  const columns = Math.max(1, Math.ceil(Math.sqrt(totalNodes)));
  const spacingX = 260;
  const spacingY = 180;
  return {
    x: (index % columns) * spacingX,
    y: Math.floor(index / columns) * spacingY,
  };
}

function buildRankedNodes(
  nodeIds: string[],
  dagreGraph: DagreGraph
): RankedNode[] {
  return nodeIds.map((id) => {
    const nodeWithPosition = dagreGraph.node(id) as { x: number; y: number; rank?: number } | undefined;
    return {
      id,
      x: nodeWithPosition?.x ?? 0,
      y: nodeWithPosition?.y ?? 0,
      rank: Number.isFinite(nodeWithPosition?.rank) ? (nodeWithPosition?.rank ?? 0) : 0,
    };
  });
}

function buildEdgesBySource(edges: LayoutEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  edges.forEach((edge) => {
    const list = map.get(edge.source);
    if (list) {
      list.push(edge.target);
    } else {
      map.set(edge.source, [edge.target]);
    }
  });
  return map;
}

function buildEdgesByTarget(edges: LayoutEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  edges.forEach((edge) => {
    const list = map.get(edge.target);
    if (list) {
      list.push(edge.source);
    } else {
      map.set(edge.target, [edge.source]);
    }
  });
  return map;
}

function alignNodesByDependencies(
  rankedNodes: RankedNode[],
  edgesBySource: Map<string, string[]>,
  edgesByTarget: Map<string, string[]>
): Map<string, number> {
  const centerXById = new Map<string, number>(rankedNodes.map((node) => [node.id, node.x]));
  const nodesById = new Map(rankedNodes.map((node) => [node.id, node]));
  const nodesByRank = groupNodesByRank(rankedNodes);
  const sortedRanks = Array.from(nodesByRank.keys()).sort((a, b) => b - a);

  for (const rank of sortedRanks) {
    const nodes = nodesByRank.get(rank) ?? [];
    if (nodes.length === 0) {
      continue;
    }
    const desired = nodes.map((node) => {
      const deps = edgesBySource.get(node.id) ?? [];
      const depXs = deps
        .map((depId) => centerXById.get(depId))
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const fallbackX = centerXById.get(node.id) ?? node.x;
      const desiredX = depXs.length > 0 ? average(depXs) : fallbackX;
      return { id: node.id, desiredX };
    });

    const adjusted = spreadRankPositions(desired, NODE_WIDTH + NODE_SEP);
    for (const [id, x] of adjusted.entries()) {
      centerXById.set(id, x);
    }
  }

  const fanoutProposals = buildFanoutProposals(edgesByTarget, centerXById, nodesById);
  for (const [id, proposalX] of fanoutProposals.entries()) {
    const current = centerXById.get(id) ?? nodesById.get(id)?.x ?? proposalX;
    centerXById.set(id, lerp(current, proposalX, FANOUT_WEIGHT));
  }

  for (const rank of sortedRanks) {
    const nodes = nodesByRank.get(rank) ?? [];
    if (nodes.length === 0) {
      continue;
    }
    const desired = nodes.map((node) => ({
      id: node.id,
      desiredX: centerXById.get(node.id) ?? node.x,
    }));
    const adjusted = spreadRankPositions(desired, NODE_WIDTH + NODE_SEP);
    for (const [id, x] of adjusted.entries()) {
      centerXById.set(id, x);
    }
  }

  return centerXById;
}

function buildFanoutProposals(
  edgesByTarget: Map<string, string[]>,
  centerXById: Map<string, number>,
  nodesById: Map<string, RankedNode>
): Map<string, number> {
  const proposals = new Map<string, number[]>();

  for (const [targetId, dependents] of edgesByTarget.entries()) {
    if (dependents.length < 2) {
      continue;
    }
    const currentXs = dependents.map((id) => centerXById.get(id) ?? nodesById.get(id)?.x ?? 0);
    const minX = Math.min(...currentXs);
    const maxX = Math.max(...currentXs);
    if (maxX - minX > FANOUT_RANGE_THRESHOLD) {
      continue;
    }

    const baseX = centerXById.get(targetId) ?? nodesById.get(targetId)?.x ?? 0;
    const sorted = [...dependents].sort((a, b) => {
      const ax = centerXById.get(a) ?? nodesById.get(a)?.x ?? 0;
      const bx = centerXById.get(b) ?? nodesById.get(b)?.x ?? 0;
      return ax - bx;
    });
    const centerIndex = (sorted.length - 1) / 2;

    sorted.forEach((dependentId, index) => {
      const offset = (index - centerIndex) * FANOUT_SPACING;
      const candidate = baseX + offset;
      const list = proposals.get(dependentId);
      if (list) {
        list.push(candidate);
      } else {
        proposals.set(dependentId, [candidate]);
      }
    });
  }

  const averaged = new Map<string, number>();
  for (const [id, values] of proposals.entries()) {
    averaged.set(id, average(values));
  }

  return averaged;
}

function groupNodesByRank(nodes: RankedNode[]): Map<number, RankedNode[]> {
  const map = new Map<number, RankedNode[]>();
  for (const node of nodes) {
    const list = map.get(node.rank);
    if (list) {
      list.push(node);
    } else {
      map.set(node.rank, [node]);
    }
  }
  return map;
}

function spreadRankPositions(
  items: Array<{ id: string; desiredX: number }>,
  minSpacing: number
): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.desiredX - b.desiredX);
  const adjusted = new Map<string, number>();
  let cursor: number | null = null;
  for (const item of sorted) {
    let nextX = item.desiredX;
    if (cursor !== null && nextX < cursor + minSpacing) {
      nextX = cursor + minSpacing;
    }
    adjusted.set(item.id, nextX);
    cursor = nextX;
  }
  const originalMean = average(sorted.map((item) => item.desiredX));
  const adjustedMean = average(Array.from(adjusted.values()));
  const shift = Number.isFinite(originalMean) && Number.isFinite(adjustedMean)
    ? originalMean - adjustedMean
    : 0;
  if (shift !== 0) {
    for (const [id, value] of adjusted.entries()) {
      adjusted.set(id, value + shift);
    }
  }
  return adjusted;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function lerp(from: number, to: number, weight: number): number {
  return from + (to - from) * weight;
}
