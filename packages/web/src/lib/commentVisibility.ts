import type { Edge, Node } from '@xyflow/react';
import type { GraphData } from './types';
import type { CommentNode } from './commentTypes';
import {
  COMMENT_EDGE_TYPE,
  buildCommentNodeId,
  type CommentNodeData,
  sortCommentLinks,
} from './commentTypes';

const COMMENT_EDGE_STYLE = {
  stroke: '#94a3b8',
  strokeDasharray: '6 4',
  strokeWidth: 2,
};

export function buildCommentElements({
  graph,
  comments,
  showComments,
}: {
  graph: GraphData;
  comments: CommentNode[];
  showComments: boolean;
}): { nodes: Node[]; edges: Edge[] } {
  if (!showComments || comments.length === 0) {
    return { nodes: [], edges: [] };
  }

  const visibleTargetIds = new Set(graph.nodes.map((node) => node.id));
  const sortedComments = [...comments].sort((a, b) => a.id.localeCompare(b.id));

  const nodes: Node[] = sortedComments.map((comment) => ({
    id: buildCommentNodeId(comment.id),
    type: 'comment',
    position: { ...comment.position },
    data: {
      id: comment.id,
      content: comment.content,
      tags: comment.tags,
      priority: comment.priority,
    } as CommentNodeData,
    draggable: false,
    selectable: false,
  }));

  const edges: Edge[] = [];
  for (const comment of sortedComments) {
    const source = buildCommentNodeId(comment.id);
    const sortedLinks = sortCommentLinks(comment.links);

    for (const link of sortedLinks) {
      if (!visibleTargetIds.has(link.id)) {
        continue;
      }
      edges.push({
        id: `comment-link:${comment.id}:${link.type}:${link.id}`,
        source,
        target: link.id,
        type: COMMENT_EDGE_TYPE,
        style: COMMENT_EDGE_STYLE,
        animated: false,
      });
    }
  }

  return { nodes, edges };
}
