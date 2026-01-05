import { z } from 'zod';
import { ExportSchema, ImportListSchema } from './common.js';

const RawFileSchema = z.object({
  path: z.string().optional(),
  exports: z.array(ExportSchema),
  imports: ImportListSchema,
  linesOfCode: z.number(),
}).describe('Per-file export/import summary');

const RawClusterSchema = z.object({
  id: z.string(),
  files: z.array(z.string()),
}).describe('Lightweight cluster definition');

export const RawGraphSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string(),
  files: z.record(z.string(), RawFileSchema),
  dependencies: z.record(z.string(), z.array(z.string())).describe('File dependency adjacency list'),
  clusters: z.array(RawClusterSchema).optional(),
});

export type RawGraph = z.infer<typeof RawGraphSchema>;
