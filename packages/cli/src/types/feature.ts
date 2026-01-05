import { z } from 'zod';
import { MetadataSchema, SourceSchema } from './common.js';

const FeatureStatusSchema = z.enum(['active', 'ignored', 'deprecated']);
const FeatureScopeSchema = z.enum(['frontend', 'backend', 'fullstack', 'shared']);

const FeatureCompositionSchema = z.object({
  hash: z.string(),
}).describe('Stable hash of the feature composition');

const FeatureLocksSchema = z.object({
  name: z.boolean().optional(),
  description: z.boolean().optional(),
  clusters: z.boolean().optional(),
}).describe('Manual edit protection');

export const FeatureSchema = z.object({
  version: z.number().int().positive(),
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  purpose: z.string().optional(),
  source: SourceSchema,
  status: FeatureStatusSchema,
  scope: FeatureScopeSchema,
  clusters: z.array(z.string()),
  dependsOn: z.array(z.string()).optional(),
  composition: FeatureCompositionSchema,
  locks: FeatureLocksSchema.optional(),
  metadata: MetadataSchema,
  reasoning: z.string().optional(),
}).describe('AI-grouped feature definition');

export type Feature = z.infer<typeof FeatureSchema>;
