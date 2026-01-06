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

interface CommentNodeWithUi extends CommentNode {
  isEditing?: boolean;
  saveState?: CommentNodeData['saveState'];
  saveError?: CommentNodeData['saveError'];
  status?: 'draft' | 'saved';
}

export interface CommentNodeHandlers {
  onStartEdit: (id: string) => void;
  onCommitEdit: (id: string, value: string) => void;
  onCancelEdit: (id: string) => void;
}

export function buildCommentElements({
  graph,
  comments,
  showComments,
  handlers,
}: {
  graph: GraphData;
  comments: CommentNode[];
  showComments: boolean;
  handlers?: CommentNodeHandlers;
}): { nodes: Node[]; edges: Edge[] } {
  if (!showComments || comments.length === 0) {
    return { nodes: [], edges: [] };
  }

  const visibleTargetIds = new Set(graph.nodes.map((node) => node.id));
  const sortedComments = [...comments].sort((a, b) => a.id.localeCompare(b.id));

  const nodes: Node[] = sortedComments.map((comment) => {
    const hasContent = comment.content.trim().length > 0;
    const hasLinks = comment.links.length > 0;
    const isDraft =
      ('status' in comment ? comment.status === 'draft' : false) || !hasContent || !hasLinks;
    const isEditing =
      'isEditing' in comment ? Boolean((comment as CommentNodeWithUi).isEditing) : false;
    const saveState =
      'saveState' in comment ? (comment as CommentNodeWithUi).saveState : undefined;
    const saveError =
      'saveError' in comment ? (comment as CommentNodeWithUi).saveError : undefined;

    const data: CommentNodeData = {
      id: comment.id,
      content: comment.content,
      isDraft,
      isEditing,
      saveState,
      saveError,
      onStartEdit: handlers?.onStartEdit ? () => handlers.onStartEdit(comment.id) : undefined,
      onCommitEdit: handlers?.onCommitEdit
        ? (value) => handlers.onCommitEdit(comment.id, value)
        : undefined,
      onCancelEdit: handlers?.onCancelEdit ? () => handlers.onCancelEdit(comment.id) : undefined,
    };

    return {
      id: buildCommentNodeId(comment.id),
      type: 'comment',
      position: { ...comment.position },
      data,
      draggable: !isEditing,
      deletable: true,
      selectable: true,
    };
  });

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
        deletable: true,
        style: COMMENT_EDGE_STYLE,
        animated: false,
      });
    }
  }

  return { nodes, edges };
}
