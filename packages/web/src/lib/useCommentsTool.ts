import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react';
import type { FeatureMapData, GraphData } from './types';
import { buildCommentElements } from './commentVisibility';
import { COMMENT_NODE_PREFIX, isCommentNodeId } from './commentTypes';
import {
  createDraftComment,
  isDraftComment,
  mergeSavedComments,
  toggleAddMode,
  toggleCommentLink,
  type CommentToolMode,
  type UiComment,
} from './commentsMode';
import { CommentsApiError, useCommentsApi } from './useCommentsApi';

interface UseCommentsToolInput {
  data: FeatureMapData | null;
  visibleGraph: GraphData | null;
  showComments: boolean;
  reactFlowInstance: ReactFlowInstance | null;
}

export interface UseCommentsToolResult {
  commentElements: { nodes: Node[]; edges: Edge[] };
  commentToolMode: CommentToolMode;
  activeComment: UiComment | null;
  commentSaveError: string | null;
  isSavingComment: boolean;
  handleNodeClick: (nodeId: string) => 'comment' | 'link' | null;
  handlePaneClick: (event: MouseEvent) => void;
  handleCommentChange: (updates: Partial<UiComment>) => void;
  handleCommentCancel: () => void;
  handleCommentSave: () => Promise<void>;
  toggleAddMode: () => void;
  toggleLinkMode: () => void;
}

export function useCommentsTool({
  data,
  visibleGraph,
  showComments,
  reactFlowInstance,
}: UseCommentsToolInput): UseCommentsToolResult {
  const [commentToolMode, setCommentToolMode] = useState<CommentToolMode>('off');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<UiComment[]>([]);
  const [commentSaveError, setCommentSaveError] = useState<string | null>(null);
  const [isSavingComment, setIsSavingComment] = useState(false);

  const { upsertComment } = useCommentsApi();

  const commentElements = useMemo(() => {
    if (!visibleGraph) {
      return { nodes: [], edges: [] };
    }
    return buildCommentElements({
      graph: visibleGraph,
      comments,
      showComments,
    });
  }, [comments, showComments, visibleGraph]);

  const activeComment = activeCommentId
    ? comments.find((comment) => comment.id === activeCommentId) ?? null
    : null;

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

  useEffect(() => {
    if (!activeCommentId) {
      return;
    }
    const exists = comments.some((comment) => comment.id === activeCommentId);
    if (!exists) {
      setActiveCommentId(null);
      setCommentToolMode('off');
    }
  }, [activeCommentId, comments]);

  const handleNodeClick = (nodeId: string): 'comment' | 'link' | null => {
    if (isCommentNodeId(nodeId)) {
      const commentId = nodeId.slice(COMMENT_NODE_PREFIX.length);
      setActiveCommentId(commentId);
      setCommentSaveError(null);
      return 'comment';
    }

    if (commentToolMode === 'link' && activeCommentId && data?.entities[nodeId]) {
      const target = data.entities[nodeId];
      const linkType = target.kind === 'feature' ? 'feature' : 'cluster';
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === activeCommentId
            ? toggleCommentLink(comment, { type: linkType, id: nodeId })
            : comment
        )
      );
      return 'link';
    }

    return null;
  };

  const handlePaneClick = (event: MouseEvent) => {
    if (commentToolMode !== 'add' || !reactFlowInstance) {
      return;
    }

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const draft = createDraftComment(position);
    setComments((prev) => [...prev, draft]);
    setActiveCommentId(draft.id);
    setCommentSaveError(null);
  };

  const handleCommentChange = (updates: Partial<UiComment>) => {
    if (!activeComment) {
      return;
    }
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === activeComment.id ? { ...comment, ...updates } : comment
      )
    );
  };

  const handleCommentCancel = () => {
    if (!activeComment) {
      return;
    }
    if (isDraftComment(activeComment)) {
      setComments((prev) => prev.filter((comment) => comment.id !== activeComment.id));
    } else if (data) {
      const saved = data.comments.find((comment) => comment.id === activeComment.id);
      if (saved) {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === saved.id ? { ...saved, status: 'saved', isDirty: false } : comment
          )
        );
      }
    }
    setActiveCommentId(null);
    setCommentToolMode('off');
    setCommentSaveError(null);
  };

  const handleCommentSave = async () => {
    if (!activeComment) {
      return;
    }
    setIsSavingComment(true);
    setCommentSaveError(null);

    try {
      const payload = {
        id: isDraftComment(activeComment) ? undefined : activeComment.id,
        content: activeComment.content,
        position: activeComment.position,
        links: activeComment.links,
        tags: activeComment.tags,
        priority: activeComment.priority,
        author: activeComment.author,
        createdAt: activeComment.createdAt,
        updatedAt: activeComment.updatedAt,
      };

      const saved = await upsertComment(payload);
      setComments((prev) => {
        const withoutOld = prev.filter((comment) => comment.id !== activeComment.id);
        return [...withoutOld, { ...saved, status: 'saved', isDirty: false }].sort((a, b) =>
          a.id.localeCompare(b.id)
        );
      });
      setActiveCommentId(saved.id);
      setCommentToolMode('off');
    } catch (error) {
      if (error instanceof CommentsApiError) {
        if (error.type === 'token_missing' || error.type === 'forbidden') {
          setCommentSaveError(
            'Token required to save comments (run featuremap serve and paste token).'
          );
        } else {
          setCommentSaveError(error.message);
        }
      } else {
        setCommentSaveError('Failed to save comment.');
      }
    } finally {
      setIsSavingComment(false);
    }
  };

  const toggleAddModeHandler = () => {
    setCommentToolMode((mode) => toggleAddMode(mode));
    setCommentSaveError(null);
  };

  const toggleLinkModeHandler = () => {
    if (!activeComment) {
      return;
    }
    setCommentToolMode((mode) => (mode === 'link' ? 'off' : 'link'));
  };

  return {
    commentElements,
    commentToolMode,
    activeComment,
    commentSaveError,
    isSavingComment,
    handleNodeClick,
    handlePaneClick,
    handleCommentChange,
    handleCommentCancel,
    handleCommentSave,
    toggleAddMode: toggleAddModeHandler,
    toggleLinkMode: toggleLinkModeHandler,
  };
}
