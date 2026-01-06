import { z } from 'zod';

export const GroupSourceSchema = z.enum(['ai', 'user']);

export const GroupLocksSchema = z.object({
  name: z.boolean().optional(),
  description: z.boolean().optional(),
  featureIds: z.boolean().optional(),
});

export const GroupMetadataSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  lastModifiedBy: GroupSourceSchema,
  version: z.number(),
});

export const GroupSchema = z.object({
  version: z.number().int().positive(),
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  featureIds: z.array(z.string()),
  source: GroupSourceSchema,
  locks: GroupLocksSchema.optional(),
  metadata: GroupMetadataSchema,
});

export type GroupFile = z.infer<typeof GroupSchema>;
export type GroupLocks = z.infer<typeof GroupLocksSchema>;
export type GroupMetadata = z.infer<typeof GroupMetadataSchema>;
