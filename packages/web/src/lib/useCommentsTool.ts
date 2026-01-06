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
import { CommentsApiError, useCommentsApi } from './useCommentsApi';

interface UseCommentsToolInput {
  data: FeatureMapData | null;
  visibleGraph: GraphData | null;
  currentView: 'features' | 'clusters';
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

  const handleDelete = useCallback(
    async (id: string) => {
      const comment = comments.find((entry) => entry.id === id);
      if (!comment) {
        return;
      }

      if (comment.status === 'draft') {
        setComments((prev) => prev.filter((entry) => entry.id !== id));
        return;
      }

      updateComment(id, (entry) => ({
        ...entry,
        saveState: 'saving',
        saveError: null,
      }));

      try {
        await deleteComment(id);
        setComments((prev) => prev.filter((entry) => entry.id !== id));
      } catch (error) {
        if (error instanceof CommentsApiError) {
          const message =
            error.type === 'token_missing' || error.type === 'forbidden'
              ? 'Token required to delete comments (run featuremap serve and paste token).'
              : error.message;
          updateComment(id, (entry) => ({
            ...entry,
            saveState: 'error',
            saveError: message,
          }));
        } else {
          updateComment(id, (entry) => ({
            ...entry,
            saveState: 'error',
            saveError: 'Failed to delete comment.',
          }));
        }
      }
    },
    [comments, deleteComment, updateComment]
  );

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
    }),
    [canPersist, comments, persistComment, updateComment]
  );

  const commentElements = useMemo(() => {
    if (!visibleGraph) {
      return { nodes: [], edges: [] };
    }
    return buildCommentElements({
      graph: visibleGraph,
      comments,
      currentView,
      showComments,
      handlers,
    });
  }, [comments, currentView, handlers, showComments, visibleGraph]);

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
      if (comment.status === 'saved' && comment.links.length <= 1) {
        updateComment(commentId, (entry) => ({
          ...entry,
          saveState: 'error',
          saveError: 'At least one link is required. Delete the comment to remove all links.',
        }));
        return;
      }
      const next = removeCommentLink(comment, {
        type: linkType as 'feature' | 'cluster',
        id: linkId,
      });
      updateComment(commentId, () => next);
      if (!canPersist(next)) {
        return;
      }
      persistComment(next, { links: next.links }, false);
    },
    [canPersist, comments, persistComment, updateComment]
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
