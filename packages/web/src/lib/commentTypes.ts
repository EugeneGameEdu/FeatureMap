export const COMMENT_NODE_PREFIX = 'comment:';
export const COMMENT_EDGE_TYPE = 'comment_link';

export type CommentLinkType = 'feature' | 'cluster';
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
  content: string;
  position: CommentPosition;
  links: CommentLink[];
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
  tags?: string[];
  priority?: CommentPriority;
  linkCount?: number;
  isDraft?: boolean;
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
