import { z } from 'zod';

const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const LayoutViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

const LayoutMetadataSchema = z.object({
  updatedAt: z.string(),
});

export const LayoutSchema = z.object({
  version: z.number().int().positive(),
  positions: z.record(z.string(), NodePositionSchema),
  viewport: LayoutViewportSchema.optional(),
  metadata: LayoutMetadataSchema,
});

export type Layout = z.infer<typeof LayoutSchema>;
