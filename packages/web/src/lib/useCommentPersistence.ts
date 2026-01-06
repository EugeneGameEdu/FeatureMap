import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import type { CommentNode } from './commentTypes';
import type { UiComment } from './commentsMode';
import { CommentsApiError, type CommentUpsertPayload } from './useCommentsApi';

const SAVE_RESET_MS = 1500;

interface UseCommentPersistenceInput {
  setComments: Dispatch<SetStateAction<UiComment[]>>;
  updateComment: (id: string, updater: (comment: UiComment) => UiComment) => void;
  upsertComment: (payload: CommentUpsertPayload) => Promise<CommentNode>;
}

interface CommentPersistenceResult {
  persistComment: (
    comment: UiComment,
    override?: Partial<CommentUpsertPayload>,
    suppressValidationError?: boolean
  ) => Promise<void>;
  canPersist: (comment: UiComment) => boolean;
}

export function useCommentPersistence({
  setComments,
  updateComment,
  upsertComment,
}: UseCommentPersistenceInput): CommentPersistenceResult {
  const saveResetTimers = useRef<Map<string, number>>(new Map());

  const setSaveState = useCallback(
    (id: string, state: UiComment['saveState'], error?: string) => {
      updateComment(id, (comment) => ({
        ...comment,
        saveState: state,
        saveError: error ?? null,
      }));

      if (state === 'saved') {
        const existing = saveResetTimers.current.get(id);
        if (existing) {
          window.clearTimeout(existing);
        }
        const timer = window.setTimeout(() => {
          updateComment(id, (comment) =>
            comment.saveState === 'saved' ? { ...comment, saveState: 'idle' } : comment
          );
        }, SAVE_RESET_MS);
        saveResetTimers.current.set(id, timer);
      }
    },
    [updateComment]
  );

  const validateComment = useCallback((comment: UiComment): string | null => {
    if (!comment.content.trim()) {
      return 'Content required to save.';
    }
    if (comment.links.length === 0) {
      return 'Add at least one link to save.';
    }
    return null;
  }, []);

  const canPersist = useCallback(
    (comment: UiComment): boolean => validateComment(comment) === null,
    [validateComment]
  );

  const buildPayload = useCallback(
    (comment: UiComment, override: Partial<CommentUpsertPayload> = {}): CommentUpsertPayload => {
      return {
        ...(comment.status === 'saved' ? { id: comment.id } : {}),
        content: override.content ?? comment.content,
        position: override.position ?? comment.position,
        links: override.links ?? comment.links,
        ...(comment.author ? { author: comment.author } : {}),
        ...(comment.createdAt ? { createdAt: comment.createdAt } : {}),
        ...(comment.updatedAt ? { updatedAt: comment.updatedAt } : {}),
        ...(comment.tags ? { tags: comment.tags } : {}),
        ...(comment.priority ? { priority: comment.priority } : {}),
      };
    },
    []
  );

  const persistComment = useCallback(
    async (
      comment: UiComment,
      override: Partial<CommentUpsertPayload> = {},
      suppressValidationError = false
    ) => {
      const errorMessage = validateComment(comment);
      if (comment.status === 'draft' && errorMessage) {
        if (!suppressValidationError) {
          setSaveState(comment.id, 'idle');
        }
        return;
      }

      setSaveState(comment.id, 'saving');
      try {
        const payload =
          comment.status === 'draft'
            ? buildPayload(comment, override)
            : { id: comment.id, ...override };
        const saved = await upsertComment(payload);
        setComments((prev) => {
          const withoutOld = prev.filter((entry) => entry.id !== comment.id);
          return [
            ...withoutOld,
            {
              ...saved,
              status: 'saved',
              isDirty: false,
              isEditing: false,
              saveError: null,
              saveState: 'saved',
            },
          ].sort((a, b) => a.id.localeCompare(b.id));
        });
        setSaveState(saved.id, 'saved');
      } catch (error) {
        if (error instanceof CommentsApiError) {
          const message =
            error.type === 'token_missing' || error.type === 'forbidden'
              ? 'Token required to save comments (run featuremap serve and paste token).'
              : error.message;
          setSaveState(comment.id, 'error', message);
        } else {
          setSaveState(comment.id, 'error', 'Failed to save comment.');
        }
      }
    },
    [buildPayload, setComments, setSaveState, upsertComment, validateComment]
  );

  return { persistComment, canPersist };
}
