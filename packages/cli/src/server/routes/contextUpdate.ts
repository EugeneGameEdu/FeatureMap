import type { RequestHandler } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import {
  ConstraintsSchema,
  DecisionsSchema,
  DesignSystemSchema,
  OverviewSchema,
} from '../../types/context.js';
import { saveYAML } from '../../utils/yaml-loader.js';
import type { WsHub } from '../wsHub.js';

const AUTO_CONTEXT_FILES = new Set(['tech-stack.yaml', 'conventions.yaml']);

const MANUAL_CONTEXT_SCHEMAS = {
  'decisions.yaml': DecisionsSchema,
  'constraints.yaml': ConstraintsSchema,
  'overview.yaml': OverviewSchema,
  'design-system.yaml': DesignSystemSchema,
} as const;

type ManualContextFile = keyof typeof MANUAL_CONTEXT_SCHEMAS;

const UpdateRequestSchema = z.object({
  file: z.string(),
  data: z.unknown(),
});

interface ContextUpdateHandlerOptions {
  projectRoot: string;
  wsHub?: WsHub | null;
}

export function createContextUpdateHandler(
  options: ContextUpdateHandlerOptions
): RequestHandler {
  const featuremapDir = path.resolve(options.projectRoot, '.featuremap');
  const contextDir = path.resolve(featuremapDir, 'context');

  return (req, res) => {
    const parseResult = UpdateRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid request body.' });
      return;
    }

    const { file, data } = parseResult.data;

    if (AUTO_CONTEXT_FILES.has(file)) {
      res.status(400).json({ error: `Updates to ${file} are not allowed.` });
      return;
    }

    if (!Object.hasOwn(MANUAL_CONTEXT_SCHEMAS, file)) {
      res.status(400).json({ error: `Unsupported context file "${file}".` });
      return;
    }

    if (!fs.existsSync(featuremapDir)) {
      res.status(400).json({ error: 'Missing .featuremap/ directory.' });
      return;
    }

    fs.mkdirSync(contextDir, { recursive: true });

    const targetPath = path.resolve(contextDir, file);
    const relativePath = path.relative(contextDir, targetPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      res.status(403).json({ error: 'Invalid file path.' });
      return;
    }

    try {
      const schema = MANUAL_CONTEXT_SCHEMAS[file as ManualContextFile];
      saveYAML(targetPath, data, schema);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid context data.',
      });
      return;
    }

    options.wsHub?.broadcast({
      type: 'featuremap_changed',
      reason: 'context_updated',
      file,
    });

    res.json({ updated: true, file, written: true });
  };
}
