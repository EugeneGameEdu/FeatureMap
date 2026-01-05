// Типы данных для FeatureMap

export type NodeType = 'cluster' | 'feature';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  fileCount?: number;
  clusterCount?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  version: number;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ClusterExport {
  name: string;
  type: string;
  isDefault?: boolean;
}

export interface ClusterImports {
  internal: string[];
  external: string[];
}

export interface Cluster {
  version: number;
  id: string;
  layer: 'frontend' | 'backend' | 'shared' | 'infrastructure';
  layerDetection?: {
    confidence: 'high' | 'medium' | 'low';
    signals: string[];
  };
  files: string[];
  exports: ClusterExport[];
  imports: ClusterImports;
  purpose_hint?: string;
  entry_points?: string[];
  compositionHash?: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    lastModifiedBy?: string;
    version?: number;
  };
}

export interface Feature {
  version: number;
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  source: 'auto' | 'ai' | 'user';
  status: 'active' | 'ignored' | 'deprecated';
  scope: 'frontend' | 'backend' | 'fullstack' | 'shared';
  clusters: string[];
  dependsOn?: string[];
  composition: {
    hash: string;
  };
  locks?: {
    name?: boolean;
    description?: boolean;
    clusters?: boolean;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    lastModifiedBy?: string;
    version?: number;
  };
  reasoning?: string;
}

export type MapEntity =
  | { kind: 'cluster'; label: string; data: Cluster }
  | { kind: 'feature'; label: string; data: Feature };

export interface FeatureMapData {
  graph: GraphData;
  entities: Record<string, MapEntity>;
}
