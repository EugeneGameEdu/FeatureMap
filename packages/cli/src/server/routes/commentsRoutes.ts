import express from 'express';
import { z } from 'zod';
import type { WsHub } from '../wsHub.js';
import { requireToken } from '../security.js';
import { deleteComment, listComments, upsertComment } from '../commentsStore.js';
import { CommentNodeSchema } from '../../types/index.js';

const CommentUpsertSchema = z.object({
  id: z.string().optional(),
  homeView: z.enum(['features', 'clusters']).optional(),
  content: z.string().optional(),
  position: CommentNodeSchema.shape.position.optional(),
  links: CommentNodeSchema.shape.links.optional(),
  pinned: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  author: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

interface CommentsRouterOptions {
  projectRoot: string;
  sessionToken: string;
  wsHub: WsHub | null;
}

export function createCommentsRouter(options: CommentsRouterOptions): express.Router {
  const router = express.Router();

  router.get('/', (_req, res) => {
    const comments = listComments(options.projectRoot);
    res.json(comments);
  });

  router.post('/upsert', requireToken(options.sessionToken), (req, res) => {
    const parsed = CommentUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodError(parsed.error) });
      return;
    }

    try {
      const saved = upsertComment(options.projectRoot, parsed.data);
      options.wsHub?.broadcast({
        type: 'featuremap_changed',
        reason: 'comments_updated',
        file: `comments/${saved.id}`,
      });
      res.json(saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save comment.';
      res.status(400).json({ error: message });
    }
  });

  router.delete('/:id', requireToken(options.sessionToken), (req, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Comment id is required.' });
      return;
    }

    try {
      deleteComment(options.projectRoot, id);
      options.wsHub?.broadcast({
        type: 'featuremap_changed',
        reason: 'comments_updated',
        file: `comments/${id}`,
      });
      res.json({ id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete comment.';
      res.status(400).json({ error: message });
    }
  });

  router.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return router;
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
}
