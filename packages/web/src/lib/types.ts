import { z } from 'zod';
import type { ContextData } from './contextTypes';

// РўРёРїС< Р?Р°Р?Р?С<С: Р?Р>С? FeatureMap

export type NodeType = 'cluster' | 'feature';
export type ViewMode = 'clusters' | 'features';

export const GraphNodeSchema = z
  .object({
    id: z.string(),
    label: z.string().optional(),
    type: z.string().optional(),
    fileCount: z.number().optional(),
    clusterCount: z.number().optional(),
  })
  .passthrough();

export const GraphEdgeSchema = z
  .object({
    source: z.string(),
    target: z.string(),
    type: z.string().optional(),
  })
  .passthrough();

export const GraphSchema = z.object({
  version: z.number(),
  generatedAt: z.string(),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphData = z.infer<typeof GraphSchema>;

const LayerSchema = z.enum(['frontend', 'backend', 'shared', 'infrastructure']);

const ClusterExportSchema = z.object({
  name: z.string(),
  type: z.string(),
  isDefault: z.boolean().optional(),
});

const ClusterImportsSchema = z.object({
  internal: z.array(z.string()),
  external: z.array(z.string()),
});

export const ClusterSchema = z
  .object({
    version: z.number(),
    id: z.string(),
    layer: LayerSchema,
    layerDetection: z
      .object({
        confidence: z.enum(['high', 'medium', 'low']),
        signals: z.array(z.string()),
      })
      .optional(),
    locks: z
      .object({
        layer: z.boolean().optional(),
        files: z.boolean().optional(),
      })
      .optional(),
    files: z.array(z.string()),
    exports: z.array(ClusterExportSchema),
    imports: ClusterImportsSchema,
    purpose_hint: z.string().optional(),
    entry_points: z.array(z.string()).optional(),
    compositionHash: z.string().optional(),
    metadata: z.object({
      createdAt: z.string(),
      updatedAt: z.string(),
      lastModifiedBy: z.string().optional(),
      version: z.number().optional(),
    }),
  })
  .passthrough();

export type Cluster = z.infer<typeof ClusterSchema>;
export type ClusterExport = z.infer<typeof ClusterExportSchema>;
export type ClusterImports = z.infer<typeof ClusterImportsSchema>;

const FeatureLocksSchema = z
  .object({
    name: z.boolean().optional(),
    description: z.boolean().optional(),
    clusters: z.boolean().optional(),
    scope: z.boolean().optional(),
    dependsOn: z.boolean().optional(),
    status: z.boolean().optional(),
  })
  .optional();

export const FeatureSchema = z
  .object({
    version: z.number(),
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    purpose: z.string().optional(),
    source: z.enum(['auto', 'ai', 'user']),
    status: z.enum(['active', 'ignored', 'deprecated']),
    scope: z.enum(['frontend', 'backend', 'fullstack', 'shared']),
    clusters: z.array(z.string()),
    dependsOn: z.array(z.string()).optional(),
    composition: z.object({
      hash: z.string(),
    }),
    locks: FeatureLocksSchema,
    metadata: z.object({
      createdAt: z.string(),
      updatedAt: z.string(),
      lastModifiedBy: z.string().optional(),
      version: z.number().optional(),
    }),
    reasoning: z.string().optional(),
  })
  .passthrough();

export type Feature = z.infer<typeof FeatureSchema>;

export const FeatureClusterDetailSchema = z.object({
  id: z.string(),
  layer: LayerSchema.optional(),
  purpose_hint: z.string().optional(),
  fileCount: z.number().optional(),
  missing: z.boolean().optional(),
});

export type FeatureClusterDetail = z.infer<typeof FeatureClusterDetailSchema>;

export const FeatureDetailsSchema = FeatureSchema.extend({
  clustersDetailed: z.array(FeatureClusterDetailSchema),
});

export type FeatureDetails = z.infer<typeof FeatureDetailsSchema>;

export type MapEntity =
  | { kind: 'cluster'; label: string; data: Cluster }
  | { kind: 'feature'; label: string; data: FeatureDetails };

export interface FeatureMapData {
  graph: GraphData;
  clusterGraph: GraphData;
  featureGraph: GraphData;
  entities: Record<string, MapEntity>;
  context: ContextData;
}

export * from './contextTypes';
