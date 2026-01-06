export const COMMENT_NODE_PREFIX = 'comment:';
export const COMMENT_EDGE_TYPE = 'comment_link';

export type CommentLinkType = 'feature' | 'cluster';
export type CommentHomeView = 'features' | 'clusters';
export type CommentPriority = 'low' | 'medium' | 'high';

export interface CommentLink {
  type: CommentLinkType;
  id: string;
}

export interface CommentPosition {
  x: number;
  y: number;
}

export interface CommentNode {
  version: number;
  id: string;
  homeView?: CommentHomeView;
  content: string;
  position: CommentPosition;
  links: CommentLink[];
  pinned?: boolean;
  tags?: string[];
  priority?: CommentPriority;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommentIndex {
  version?: number;
  comments: string[];
}

export interface CommentNodeData {
  id: string;
  content: string;
  isDraft: boolean;
  isEditing: boolean;
  isPinned?: boolean;
  showOrphanWarning?: boolean;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  saveError?: string | null;
  onStartEdit?: () => void;
  onCommitEdit?: (value: string) => void;
  onCancelEdit?: () => void;
  onTogglePin?: () => void;
}

export function buildCommentNodeId(commentId: string): string {
  return `${COMMENT_NODE_PREFIX}${commentId}`;
}

export function isCommentNodeId(nodeId: string): boolean {
  return nodeId.startsWith(COMMENT_NODE_PREFIX);
}

export function sortCommentLinks(links: CommentLink[]): CommentLink[] {
  return [...links].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    return a.id.localeCompare(b.id);
  });
}

export function inferCommentHomeView(links: CommentLink[]): CommentHomeView {
  if (links.some((link) => link.type === 'feature')) {
    return 'features';
  }
  if (links.some((link) => link.type === 'cluster')) {
    return 'clusters';
  }
  return 'features';
}

export function resolveCommentHomeView(comment: Pick<CommentNode, 'homeView' | 'links'>): CommentHomeView {
  return comment.homeView ?? inferCommentHomeView(comment.links);
}
