import { z } from 'zod';
import { FileReferenceSchema, LayerSchema, MetadataSchema, SourceSchema } from './common.js';

const FeatureLockSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  clusters: z.array(z.string()).optional(),
  layer: LayerSchema.optional(),
}).describe('Manual edit protection');

const FeatureCompositionSchema = z.object({
  hash: z.string(),
}).describe('Stable hash of the feature composition');

const FeatureReasoningSchema = z.string().describe('AI reasoning notes');

export const FeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  purpose: z.string().optional(),
  source: SourceSchema,
  status: z.string().describe('Lifecycle status'),
  scope: z.string().optional(),
  clusters: z.array(z.string()).optional(),
  dependsOn: z.array(z.string()).optional(),
  composition: FeatureCompositionSchema.optional(),
  locks: z.array(FeatureLockSchema).optional(),
  metadata: MetadataSchema.optional(),
  reasoning: FeatureReasoningSchema.optional(),
  files: z.array(FileReferenceSchema).optional(),
  exports: z.array(z.string()).optional(),
}).describe('AI-grouped feature definition');

export type Feature = z.infer<typeof FeatureSchema>;
