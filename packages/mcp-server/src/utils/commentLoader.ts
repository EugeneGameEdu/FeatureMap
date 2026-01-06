import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { z } from 'zod';

const COMMENT_INDEX_FILE = 'index.yaml';
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const MAX_COMMENT_LINKS = 20;

const CommentHomeViewSchema = z.enum(['features', 'clusters']);
const CommentLinkSchema = z.object({
  type: z.enum(['feature', 'cluster']),
  id: z.string(),
});

const CommentPositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const CommentNodeSchema = z
  .object({
    version: z.number().int().positive(),
    id: z.string().regex(KEBAB_CASE_REGEX, 'id must be kebab-case'),
    homeView: CommentHomeViewSchema.optional(),
    content: z.string().refine((value) => value.trim().length > 0, {
      message: 'content required',
    }),
    position: CommentPositionSchema,
    links: z.array(CommentLinkSchema).min(1).max(MAX_COMMENT_LINKS),
    tags: z.array(z.string()).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    author: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export type CommentNode = z.infer<typeof CommentNodeSchema>;
export type CommentNodeType = 'feature' | 'cluster';
export type CommentHomeView = z.infer<typeof CommentHomeViewSchema>;
export type CommentLink = z.infer<typeof CommentLinkSchema>;
export type CommentNodeWithHomeView = CommentNode & { homeView: CommentHomeView };

export function loadComments(featuremapDir: string): CommentNodeWithHomeView[] {
  const commentsDir = join(featuremapDir, 'comments');
  if (!existsSync(commentsDir)) {
    return [];
  }

  const files = readdirSync(commentsDir).filter(
    (file) => file.endsWith('.yaml') && file !== COMMENT_INDEX_FILE
  );
  const comments: CommentNodeWithHomeView[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(commentsDir, file), 'utf-8');
      const parsed = CommentNodeSchema.safeParse(parse(content));
      if (!parsed.success) {
        continue;
      }
      comments.push(ensureHomeView(parsed.data));
    } catch {
      // Skip invalid comment files.
    }
  }

  return comments.sort((a, b) => a.id.localeCompare(b.id));
}

export function filterCommentsForNode(
  comments: CommentNodeWithHomeView[],
  nodeType: CommentNodeType,
  nodeId: string
): CommentNodeWithHomeView[] {
  const expectedHomeView = nodeType === 'feature' ? 'features' : 'clusters';
  return comments
    .filter(
      (comment) =>
        comment.homeView === expectedHomeView &&
        comment.links.some((link) => link.type === nodeType && link.id === nodeId)
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

function ensureHomeView(comment: CommentNode): CommentNodeWithHomeView {
  return {
    ...comment,
    homeView: comment.homeView ?? inferHomeViewFromLinks(comment.links),
  };
}

function inferHomeViewFromLinks(links: CommentLink[]): CommentHomeView {
  if (links.some((link) => link.type === 'feature')) {
    return 'features';
  }
  if (links.some((link) => link.type === 'cluster')) {
    return 'clusters';
  }
  return 'features';
}
