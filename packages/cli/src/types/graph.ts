import { z } from 'zod';

const GraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['cluster', 'feature']).describe('Node type for React Flow'),
  fileCount: z.number().optional(),
  clusterCount: z.number().optional(),
}).describe('React Flow node');

const EdgeImportDetailSchema = z.object({
  symbol: z.string(),
  sourceFiles: z.array(z.string()),
  targetFile: z.string().optional(),
});

const GraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.string().optional(),
  imports: z.array(EdgeImportDetailSchema).optional(),
}).describe('React Flow edge');

export const GraphSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string(),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});

export type Graph = z.infer<typeof GraphSchema>;
export type EdgeImportDetail = z.infer<typeof EdgeImportDetailSchema>;
