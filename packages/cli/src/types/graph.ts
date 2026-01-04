import { z } from 'zod';
import { PositionSchema } from './common.js';

const GraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string().describe('Node type for React Flow'),
  fileCount: z.number(),
  position: PositionSchema.optional(),
}).describe('React Flow node');

const GraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
}).describe('React Flow edge');

export const GraphSchema = z.object({
  version: z.number(),
  generatedAt: z.string(),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});

export type Graph = z.infer<typeof GraphSchema>;
