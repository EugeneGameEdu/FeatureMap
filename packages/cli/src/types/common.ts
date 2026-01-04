import { z } from 'zod';

export const LayerSchema = z.enum(['frontend', 'backend', 'shared', 'infrastructure']);

export type Layer = z.infer<typeof LayerSchema>;

export const SourceSchema = z.enum(['auto', 'ai', 'user']);

export type Source = z.infer<typeof SourceSchema>;

export const MetadataSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  lastModifiedBy: z.string().optional(),
  version: z.number().optional(),
}).describe('Timestamps and provenance metadata');

export type Metadata = z.infer<typeof MetadataSchema>;

export const ExportSchema = z.object({
  name: z.string(),
  type: z.string().describe('Symbol kind (function, class, interface, etc.)'),
  isDefault: z.boolean().optional(),
});

export type ExportSymbol = z.infer<typeof ExportSchema>;

export const ImportListSchema = z.object({
  internal: z.array(z.string()).describe('Relative imports within the project'),
  external: z.array(z.string()).describe('Package imports'),
});

export type ImportList = z.infer<typeof ImportListSchema>;

export const FileReferenceSchema = z.object({
  path: z.string(),
  role: z.string().optional(),
}).describe('File reference within a feature or cluster');

export type FileReference = z.infer<typeof FileReferenceSchema>;

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type Position = z.infer<typeof PositionSchema>;
