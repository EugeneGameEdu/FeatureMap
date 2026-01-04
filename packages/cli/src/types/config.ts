import { z } from 'zod';

export const FeatureHintSchema = z.object({
  pattern: z.string(),
  type: z.string(),
}).describe('Pattern hint to guide feature grouping');

export const ConfigSchema = z.object({
  version: z.number(),
  project: z.object({
    name: z.string(),
    root: z.string(),
  }),
  scan: z.object({
    include: z.array(z.string()),
    exclude: z.array(z.string()),
  }),
  features: z.object({
    hints: z.array(FeatureHintSchema),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
