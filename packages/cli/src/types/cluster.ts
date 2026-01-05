import { z } from 'zod';
import { ExportSchema, ImportListSchema, LayerSchema, MetadataSchema } from './common.js';

const LayerDetectionSchema = z.object({
  confidence: z.enum(['high', 'medium', 'low']),
  signals: z.array(z.string()),
}).describe('Signals used to infer cluster layer');

export const ClusterSchema = z.object({
  version: z.number().int().positive(),
  id: z.string(),
  layer: LayerSchema,
  layerDetection: LayerDetectionSchema.optional(),
  locks: z
    .object({
      layer: z.boolean().optional(),
      files: z.boolean().optional(),
    })
    .optional(),
  files: z.array(z.string()).describe('Files contained in the cluster'),
  exports: z.array(ExportSchema),
  imports: ImportListSchema,
  purpose_hint: z.string().optional(),
  entry_points: z.array(z.string()).optional(),
  compositionHash: z.string().optional(),
  metadata: MetadataSchema,
});

export type Cluster = z.infer<typeof ClusterSchema>;
