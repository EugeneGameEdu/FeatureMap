import type { CommentLink, CommentNode, CommentPosition } from './commentTypes';
import { sortCommentLinks } from './commentTypes';

export type CommentToolMode = 'off' | 'place';
export type CommentSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface UiComment extends CommentNode {
  status: 'draft' | 'saved';
  isDirty?: boolean;
  isEditing?: boolean;
  saveState?: CommentSaveState;
  saveError?: string | null;
}

const DRAFT_PREFIX = 'draft-';

export function createDraftComment(position: CommentPosition): UiComment {
  return {
    version: 1,
    id: `${DRAFT_PREFIX}${Date.now()}`,
    content: '',
    position,
    links: [],
    status: 'draft',
    isEditing: true,
    saveState: 'idle',
    saveError: null,
  };
}

export function isDraftComment(comment: UiComment): boolean {
  return comment.status === 'draft';
}

export function isDraftId(id: string): boolean {
  return id.startsWith(DRAFT_PREFIX);
}

export function mergeSavedComments(
  saved: CommentNode[],
  existing: UiComment[]
): UiComment[] {
  const drafts = existing.filter((comment) => comment.status === 'draft');
  const byId = new Map(existing.map((comment) => [comment.id, comment]));

  const merged = saved.map((comment) => {
    const current = byId.get(comment.id);
    if (current?.isDirty) {
      return current;
    }
    return {
      ...comment,
      status: 'saved',
      isEditing: current?.isEditing ?? false,
      saveState: current?.saveState ?? 'idle',
      saveError: current?.saveError ?? null,
    } as UiComment;
  });

  return [...merged, ...drafts].sort((a, b) => a.id.localeCompare(b.id));
}

export function toggleAddMode(current: CommentToolMode): CommentToolMode {
  return current === 'place' ? 'off' : 'place';
}

export function addCommentLink(comment: UiComment, link: CommentLink): UiComment {
  const exists = comment.links.some((entry) => entry.type === link.type && entry.id === link.id);
  if (exists) {
    return comment;
  }
  const nextLinks = [...comment.links, link];

  return {
    ...comment,
    links: sortCommentLinks(nextLinks),
    isDirty: true,
  };
}

export function removeCommentLink(comment: UiComment, link: CommentLink): UiComment {
  const nextLinks = comment.links.filter(
    (entry) => !(entry.type === link.type && entry.id === link.id)
  );

  return {
    ...comment,
    links: sortCommentLinks(nextLinks),
    isDirty: true,
  };
}
