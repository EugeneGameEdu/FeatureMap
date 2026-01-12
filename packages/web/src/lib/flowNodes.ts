import type { Node } from '@xyflow/react';

export function mergeMeasuredNodes(nextNodes: Node[], previousNodes: Node[]): Node[] {
  if (previousNodes.length === 0) {
    return nextNodes;
  }

  const previousById = new Map(previousNodes.map((node) => [node.id, node]));

  return nextNodes.map((node) => {
    const previous = previousById.get(node.id);
    if (!previous?.measured) {
      return node;
    }
    return { ...node, measured: previous.measured };
  });
}
