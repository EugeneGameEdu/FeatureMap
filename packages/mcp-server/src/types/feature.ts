export type FeatureScope = 'frontend' | 'backend' | 'fullstack' | 'shared';
export type FeatureStatus = 'active' | 'ignored' | 'deprecated';

export interface FeatureInput {
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  scope?: FeatureScope;
  clusters: string[];
  dependsOn?: string[];
  status?: FeatureStatus;
  reasoning?: string;
}

export interface ClusterInfo {
  id: string;
  layer?: string;
  files: string[];
  compositionHash?: string;
}

export interface FeatureLocks {
  name?: boolean;
  description?: boolean;
  clusters?: boolean;
  scope?: boolean;
  dependsOn?: boolean;
  status?: boolean;
}

export interface FeatureMetadata {
  createdAt: string;
  updatedAt: string;
  lastModifiedBy?: string;
  version?: number;
}

export interface FeatureFile {
  version: number;
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  source: string;
  status: FeatureStatus;
  scope: FeatureScope;
  clusters: string[];
  dependsOn?: string[];
  composition: { hash: string };
  locks?: FeatureLocks;
  metadata: FeatureMetadata;
  reasoning?: string;
}

export interface GraphNode {
  id: string;
  label?: string;
  type?: string;
  fileCount?: number;
  clusterCount?: number;
  [key: string]: unknown;
}

export interface GraphEdge {
  source: string;
  target: string;
  type?: string;
  [key: string]: unknown;
}

export interface GraphData {
  version: number;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
