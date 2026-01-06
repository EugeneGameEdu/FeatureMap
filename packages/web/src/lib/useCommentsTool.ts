import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import type { Connection, Edge, Node, ReactFlowInstance } from '@xyflow/react';
import type { FeatureMapData, GraphData } from './types';
import { buildCommentElements, type CommentNodeHandlers } from './commentVisibility';
import { COMMENT_NODE_PREFIX, isCommentNodeId } from './commentTypes';
import {
  addCommentLink,
  createDraftComment,
  mergeSavedComments,
  removeCommentLink,
  toggleAddMode,
  type CommentToolMode,
  type UiComment,
} from './commentsMode';
import { useCommentPersistence } from './useCommentPersistence';
import { useCommentDeletion } from './useCommentDeletion';
import { useOrphanedComments } from './useOrphanedComments';
import { useCommentsApi } from './useCommentsApi';

interface UseCommentsToolInput {
  data: FeatureMapData | null;
  visibleGraph: GraphData | null;
  currentView: 'features' | 'clusters';
  selectedCommentId?: string | null;
  showComments: boolean;
  reactFlowInstance: ReactFlowInstance | null;
}
export interface UseCommentsToolResult {
  commentElements: { nodes: Node[]; edges: Edge[] };
  commentToolMode: CommentToolMode;
  placementActive: boolean;
  handleNodeClick: (nodeId: string) => boolean;
  handlePaneClick: (event: MouseEvent) => void;
  handleConnect: (connection: Connection) => void;
  handleEdgeRemove: (edgeId: string) => void;
  handleNodeDragStop: (node: Node) => void;
  handleNodeRemove: (nodeId: string) => void;
  togglePlacementMode: () => void;
}

export function useCommentsTool({
  data,
  visibleGraph,
  currentView,
  selectedCommentId,
  showComments,
  reactFlowInstance,
}: UseCommentsToolInput): UseCommentsToolResult {
  const [commentToolMode, setCommentToolMode] = useState<CommentToolMode>('off');
  const [comments, setComments] = useState<UiComment[]>([]);
  const { upsertComment, deleteComment } = useCommentsApi();
  useEffect(() => {
    if (!data) {
      return;
    }
    setComments((prev) => mergeSavedComments(data.comments, prev));
  }, [data]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCommentToolMode('off');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const updateComment = useCallback((id: string, updater: (comment: UiComment) => UiComment) => {
    setComments((prev) => prev.map((comment) => (comment.id === id ? updater(comment) : comment)));
  }, []);
  const { persistComment, canPersist } = useCommentPersistence({
    setComments,
    updateComment,
    upsertComment,
  });
  const handleDelete = useCommentDeletion({
    comments,
    deleteComment,
    updateComment,
    setComments,
  });

  const { promptOrphan } = useOrphanedComments({
    comments,
    canPersist,
    persistComment,
    updateComment,
    handleDelete,
  });

  const handlers: CommentNodeHandlers = useMemo(
    () => ({
      onStartEdit: (id) => {
        updateComment(id, (comment) => ({
          ...comment,
          isEditing: true,
          saveError: null,
        }));
      },
      onCommitEdit: (id, value) => {
        const comment = comments.find((entry) => entry.id === id);
        if (!comment) {
          return;
        }
        const nextContent = value.trimEnd();
        const nextComment: UiComment = {
          ...comment,
          content: nextContent,
          isEditing: false,
          isDirty: true,
          saveError: null,
        };
        setComments((prev) => prev.map((entry) => (entry.id === id ? nextComment : entry)));
        if (nextComment.status === 'draft' && !canPersist(nextComment)) {
          return;
        }
        persistComment(nextComment, { content: nextContent });
      },
      onCancelEdit: (id) => {
        updateComment(id, (comment) => ({
          ...comment,
          isEditing: false,
          saveError: null,
        }));
      },
      onTogglePin: (id) => {
        const comment = comments.find((entry) => entry.id === id);
        if (!comment) {
          return;
        }
        const nextPinned = !comment.pinned;
        const next: UiComment = { ...comment, pinned: nextPinned, isDirty: true };
        updateComment(id, () => next);
        if (comment.status === 'saved') {
          if (next.links.length === 0 && !nextPinned) {
            promptOrphan(next);
            return;
          }
          persistComment(next, { pinned: nextPinned, links: next.links }, false);
          return;
        }
        if (comment.status === 'draft' && !comment.isEditing && canPersist(next)) {
          persistComment(next, { pinned: nextPinned }, false);
        }
      },
    }),
    [canPersist, comments, persistComment, promptOrphan, updateComment]
  );

  const commentElements = useMemo(() => {
    if (!visibleGraph) {
      return { nodes: [], edges: [] };
    }
    return buildCommentElements({
      graph: visibleGraph,
      comments,
      currentView,
      selectedCommentId,
      showComments,
      handlers,
    });
  }, [comments, currentView, handlers, selectedCommentId, showComments, visibleGraph]);

  const handleNodeClick = useCallback((nodeId: string): boolean => {
    return isCommentNodeId(nodeId);
  }, []);

  const handlePaneClick = useCallback(
    (event: MouseEvent) => {
      if (commentToolMode !== 'place' || !reactFlowInstance) {
        return;
      }
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const draft = createDraftComment(position, currentView);
      setComments((prev) => [...prev, draft]);
      setCommentToolMode('off');
    },
    [commentToolMode, currentView, reactFlowInstance]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }
      if (!isCommentNodeId(connection.source)) {
        return;
      }
      if (!data?.entities[connection.target]) {
        return;
      }

      const commentId = connection.source.slice(COMMENT_NODE_PREFIX.length);
      const target = data.entities[connection.target];
      const linkType = target.kind === 'feature' ? 'feature' : 'cluster';

      const comment = comments.find((entry) => entry.id === commentId);
      if (!comment) {
        return;
      }
      const next = addCommentLink(comment, { type: linkType, id: connection.target });
      updateComment(commentId, () => next);
      if (!canPersist(next)) {
        return;
      }
      persistComment(next, { links: next.links }, false);
    },
    [canPersist, comments, data, persistComment, updateComment]
  );

  const handleEdgeRemove = useCallback(
    (edgeId: string) => {
      if (!edgeId.startsWith('comment-link:')) {
        return;
      }
      const parts = edgeId.split(':');
      if (parts.length < 4) {
        return;
      }
      const [, commentId, linkType, linkId] = parts;
      const comment = comments.find((entry) => entry.id === commentId);
      if (!comment) {
        return;
      }
      const next = removeCommentLink(comment, {
        type: linkType as 'feature' | 'cluster',
        id: linkId,
      });
      updateComment(commentId, () => next);
      if (comment.status === 'saved') {
        if (next.links.length === 0 && !next.pinned) {
          promptOrphan(next);
          return;
        }
        if (!canPersist(next)) {
          return;
        }
        persistComment(next, { links: next.links }, false);
      }
    },
    [canPersist, comments, persistComment, promptOrphan, updateComment]
  );

  const handleNodeDragStop = useCallback(
    (node: Node) => {
      if (!isCommentNodeId(node.id)) {
        return;
      }
      const commentId = node.id.slice(COMMENT_NODE_PREFIX.length);
      const position = node.position;
      const comment = comments.find((entry) => entry.id === commentId);
      if (!comment) {
        return;
      }
      const next = { ...comment, position, isDirty: true };
      updateComment(commentId, () => next);
      if (!canPersist(next)) {
        return;
      }
      persistComment(next, { position }, false);
    },
    [canPersist, comments, persistComment, updateComment]
  );

  const handleNodeRemove = useCallback(
    (nodeId: string) => {
      if (!isCommentNodeId(nodeId)) {
        return;
      }
      const commentId = nodeId.slice(COMMENT_NODE_PREFIX.length);
      handleDelete(commentId);
    },
    [handleDelete]
  );

  const togglePlacementMode = useCallback(() => {
    setCommentToolMode((mode) => toggleAddMode(mode));
  }, []);

  return {
    commentElements,
    commentToolMode,
    placementActive: commentToolMode === 'place',
    handleNodeClick,
    handlePaneClick,
    handleConnect,
    handleEdgeRemove,
    handleNodeDragStop,
    handleNodeRemove,
    togglePlacementMode,
  };
}
