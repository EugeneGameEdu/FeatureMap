import express from 'express';
import { z } from 'zod';
import type { WsHub } from '../wsHub.js';
import { requireToken } from '../security.js';
import { updateGroupNote } from '../groupStore.js';
import { syncFeaturemapDataFile } from '../featuremapDataMirror.js';

const NoteUpdateSchema = z.object({
  note: z.string().nullable().optional(),
});

interface GroupRouterOptions {
  projectRoot: string;
  sessionToken: string;
  wsHub: WsHub | null;
}

export function createGroupRouter(options: GroupRouterOptions): express.Router {
  const router = express.Router();

  router.post('/:groupId/note', requireToken(options.sessionToken), (req, res) => {
    const groupId = req.params.groupId;
    if (!groupId) {
      res.status(400).json({ error: 'Group id is required.' });
      return;
    }

    const parsed = NoteUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodError(parsed.error) });
      return;
    }

    try {
      updateGroupNote(options.projectRoot, groupId, parsed.data.note);
      syncFeaturemapDataFile(options.projectRoot, `groups/${groupId}.yaml`);
      options.wsHub?.broadcast({
        type: 'featuremap_changed',
        reason: 'groups_updated',
        file: `groups/${groupId}.yaml`,
      });
      res.json({ updated: true, groupId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update group.';
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
