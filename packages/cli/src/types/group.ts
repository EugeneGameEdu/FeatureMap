import { z } from 'zod';

const GroupSourceSchema = z.enum(['ai', 'user']);

const GroupMetadataSchema = z
  .object({
    createdAt: z.string(),
    updatedAt: z.string(),
    lastModifiedBy: GroupSourceSchema,
    version: z.number(),
  })
  .describe('Timestamps and provenance metadata');

const GroupLocksSchema = z
  .object({
    name: z.boolean().optional(),
    description: z.boolean().optional(),
    featureIds: z.boolean().optional(),
  })
  .describe('Manual edit protection');

export const GroupSchema = z
  .object({
    version: z.number().int().positive(),
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    featureIds: z.array(z.string()),
    source: GroupSourceSchema,
    locks: GroupLocksSchema.optional(),
    metadata: GroupMetadataSchema,
  })
  .describe('User-defined feature grouping');

export type Group = z.infer<typeof GroupSchema>;
