import { z } from 'zod';
import { LayerSchema } from './common.js';

const LayerDetectionSchema = z.object({
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()),
}).describe('Signals used to infer cluster layer');

export const ClusterSchema = z.object({
  version: z.number().int().positive(),
  id: z.string(),
  layer: LayerSchema,
  files: z.array(z.string()).describe('Files contained in the cluster'),
  exports: z.array(z.string()).optional(),
  imports: z.array(z.string()).optional(),
  purpose_hint: z.string().optional(),
  entry_points: z.array(z.string()).optional(),
  compositionHash: z.string().optional(),
  layerDetection: LayerDetectionSchema.optional(),
});

export type Cluster = z.infer<typeof ClusterSchema>;
