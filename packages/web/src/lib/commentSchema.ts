import { z } from 'zod';

const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const MAX_COMMENT_LINKS = 20;

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
    version: z.number(),
    id: z.string().regex(KEBAB_CASE_REGEX, 'id must be kebab-case'),
    content: z.string(),
    position: CommentPositionSchema,
    links: z.array(CommentLinkSchema).min(1).max(MAX_COMMENT_LINKS),
    tags: z.array(z.string()).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    author: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const CommentIndexSchema = z.object({
  version: z.number().optional(),
  comments: z.array(z.string()),
});

export const CommentListSchema = z.array(CommentNodeSchema);
