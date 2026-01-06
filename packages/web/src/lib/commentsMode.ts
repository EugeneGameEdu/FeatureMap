import type { CommentLink, CommentNode, CommentPosition } from './commentTypes';
import { sortCommentLinks } from './commentTypes';

export type CommentToolMode = 'off' | 'add' | 'link';

export interface UiComment extends CommentNode {
  status: 'draft' | 'saved';
  isDirty?: boolean;
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
    return { ...comment, status: 'saved' } as UiComment;
  });

  return [...merged, ...drafts].sort((a, b) => a.id.localeCompare(b.id));
}

export function toggleAddMode(current: CommentToolMode): CommentToolMode {
  return current === 'add' ? 'off' : 'add';
}

export function getCommentModeLabel(mode: CommentToolMode): string | null {
  if (mode === 'add') {
    return 'Add comment';
  }
  if (mode === 'link') {
    return 'Link comment';
  }
  return null;
}

export function toggleCommentLink(comment: UiComment, link: CommentLink): UiComment {
  const exists = comment.links.some((entry) => entry.type === link.type && entry.id === link.id);
  const nextLinks = exists
    ? comment.links.filter((entry) => !(entry.type === link.type && entry.id === link.id))
    : [...comment.links, link];

  return {
    ...comment,
    links: sortCommentLinks(nextLinks),
    isDirty: true,
  };
}
