import { useCallback, useEffect, useRef } from 'react';
import type { UiComment } from './commentsMode';
import type { CommentUpsertPayload } from './useCommentsApi';

const ORPHAN_CONFIRM_MESSAGE =
  'Comment will be deleted because it has no links. Click Cancel to pin and keep it.';

interface UseOrphanedCommentsInput {
  comments: UiComment[];
  canPersist: (comment: UiComment) => boolean;
  persistComment: (
    comment: UiComment,
    override?: Partial<CommentUpsertPayload>,
    suppressValidationError?: boolean
  ) => Promise<void>;
  updateComment: (id: string, updater: (comment: UiComment) => UiComment) => void;
  handleDelete: (id: string) => Promise<void>;
}

interface UseOrphanedCommentsResult {
  promptOrphan: (comment: UiComment) => void;
}

export function useOrphanedComments({
  comments,
  canPersist,
  persistComment,
  updateComment,
  handleDelete,
}: UseOrphanedCommentsInput): UseOrphanedCommentsResult {
  const orphanPromptedRef = useRef<Set<string>>(new Set());

  const promptOrphan = useCallback(
    (comment: UiComment) => {
      if (!shouldPromptOrphan(comment)) {
        return;
      }

      const shouldDelete = window.confirm(ORPHAN_CONFIRM_MESSAGE);
      if (shouldDelete) {
        void handleDelete(comment.id);
        return;
      }

      const next: UiComment = { ...comment, pinned: true, isDirty: true };
      updateComment(comment.id, () => next);
      if (!canPersist(next)) {
        return;
      }
      void persistComment(next, { pinned: true, links: next.links }, false);
    },
    [canPersist, handleDelete, persistComment, updateComment]
  );

  useEffect(() => {
    const orphaned = comments.filter(shouldPromptOrphan);
    for (const comment of orphaned) {
      if (orphanPromptedRef.current.has(comment.id)) {
        continue;
      }
      orphanPromptedRef.current.add(comment.id);
      promptOrphan(comment);
    }
  }, [comments, promptOrphan]);

  return { promptOrphan };
}

function shouldPromptOrphan(comment: UiComment): boolean {
  return comment.status === 'saved' && comment.links.length === 0 && !comment.pinned;
}
