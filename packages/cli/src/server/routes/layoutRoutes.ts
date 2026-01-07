import express from 'express';
import { z } from 'zod';
import type { WsHub } from '../wsHub.js';
import { requireToken } from '../security.js';
import { updateLayoutPositions } from '../layoutStore.js';

const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const LayoutUpdateSchema = z.object({
  positions: z.record(z.string(), PositionSchema).refine(
    (positions) => Object.keys(positions).length > 0,
    { message: 'At least one position is required.' },
  ),
});

interface LayoutRouterOptions {
  projectRoot: string;
  sessionToken: string;
  wsHub: WsHub | null;
}

export function createLayoutRouter(options: LayoutRouterOptions): express.Router {
  const router = express.Router();

  router.post('/positions', requireToken(options.sessionToken), (req, res) => {
    const parsed = LayoutUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodError(parsed.error) });
      return;
    }

    try {
      const layout = updateLayoutPositions(options.projectRoot, parsed.data);
      options.wsHub?.broadcast({
        type: 'featuremap_changed',
        reason: 'layout_updated',
        file: 'layout.yaml',
      });
      res.json({ updated: true, positions: layout.positions });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update layout.';
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
