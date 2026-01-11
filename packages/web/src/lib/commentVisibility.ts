import type { Edge, Node } from '@xyflow/react';
import type { GraphData } from './types';
import type { CommentNode } from './commentTypes';
import {
  COMMENT_EDGE_TYPE,
  buildCommentNodeId,
  resolveCommentHomeView,
  type CommentNodeData,
  sortCommentLinks,
} from './commentTypes';

const COMMENT_EDGE_STYLE = {
  stroke: 'hsl(var(--muted-foreground))',
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
  onTogglePin?: (id: string) => void;
}

export function getVisibleCommentIds(
  visibleNodeIds: Set<string>,
  comments: CommentNode[],
  currentView: 'features' | 'clusters'
): Set<string> {
  const visible = new Set<string>();
  for (const comment of comments) {
    if (resolveCommentHomeView(comment) !== currentView) {
      continue;
    }
    const isUnlinked = comment.links.length === 0;
    const hasVisibleLink = comment.links.some((link) => visibleNodeIds.has(link.id));
    if (!hasVisibleLink && !isUnlinked) {
      continue;
    }
    visible.add(comment.id);
  }
  return visible;
}

export function buildCommentElements({
  graph,
  comments,
  currentView,
  selectedCommentId,
  showComments,
  handlers,
}: {
  graph: GraphData;
  comments: CommentNode[];
  currentView: 'features' | 'clusters';
  selectedCommentId?: string | null;
  showComments: boolean;
  handlers?: CommentNodeHandlers;
}): { nodes: Node[]; edges: Edge[] } {
  if (!showComments || comments.length === 0) {
    return { nodes: [], edges: [] };
  }

  const visibleTargetIds = new Set(graph.nodes.map((node) => node.id));
  const visibleCommentIds = getVisibleCommentIds(visibleTargetIds, comments, currentView);
  const sortedComments = [...comments]
    .filter((comment) => visibleCommentIds.has(comment.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const nodes: Node[] = sortedComments.map((comment) => {
    const hasContent = comment.content.trim().length > 0;
    const isPinned = Boolean(comment.pinned);
    const hasLinks = comment.links.length > 0;
    const isDraft =
      ('status' in comment ? comment.status === 'draft' : false) || !hasContent;
    const isEditing =
      'isEditing' in comment ? Boolean((comment as CommentNodeWithUi).isEditing) : false;
    const saveState =
      'saveState' in comment ? (comment as CommentNodeWithUi).saveState : undefined;
    const saveError =
      'saveError' in comment ? (comment as CommentNodeWithUi).saveError : undefined;
    const showOrphanWarning =
      !hasLinks && !isPinned && ('status' in comment ? comment.status === 'saved' : false);

    const data: CommentNodeData = {
      id: comment.id,
      content: comment.content,
      isDraft,
      isEditing,
      isPinned,
      showOrphanWarning,
      saveState,
      saveError,
      onStartEdit: handlers?.onStartEdit ? () => handlers.onStartEdit(comment.id) : undefined,
      onCommitEdit: handlers?.onCommitEdit
        ? (value) => handlers.onCommitEdit(comment.id, value)
        : undefined,
      onCancelEdit: handlers?.onCancelEdit ? () => handlers.onCancelEdit(comment.id) : undefined,
      onTogglePin: handlers?.onTogglePin ? () => handlers.onTogglePin?.(comment.id) : undefined,
    };

    return {
      id: buildCommentNodeId(comment.id),
      type: 'comment',
      position: { ...comment.position },
      data,
      selected: comment.id === selectedCommentId,
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
        selectable: true,
        focusable: true,
        interactionWidth: 16,
        className: 'comment-link',
        style: COMMENT_EDGE_STYLE,
        animated: false,
      });
    }
  }

  return { nodes, edges };
}
