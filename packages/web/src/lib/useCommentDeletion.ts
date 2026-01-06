import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { UiComment } from './commentsMode';
import { CommentsApiError } from './useCommentsApi';

interface UseCommentDeletionInput {
  comments: UiComment[];
  deleteComment: (id: string) => Promise<void>;
  updateComment: (id: string, updater: (comment: UiComment) => UiComment) => void;
  setComments: Dispatch<SetStateAction<UiComment[]>>;
}

export function useCommentDeletion({
  comments,
  deleteComment,
  updateComment,
  setComments,
}: UseCommentDeletionInput): (id: string) => Promise<void> {
  return useCallback(
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
    [comments, deleteComment, setComments, updateComment]
  );
}
