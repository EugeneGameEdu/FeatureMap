// Типы данных для FeatureMap

export interface FeatureNode {
  id: string;
  label: string;
  type: string;
  fileCount: number;
}

export interface FeatureEdge {
  source: string;
  target: string;
}

export interface GraphData {
  version: number;
  generatedAt: string;
  nodes: FeatureNode[];
  edges: FeatureEdge[];
}

export interface FeatureFile {
  path: string;
  role?: string;
}

export interface Feature {
  id: string;
  name: string;
  description: string | null;
  source: 'auto' | 'ai' | 'manual';
  status: 'active' | 'deprecated' | 'ignored';
  files: FeatureFile[];
  exports: string[];
  dependsOn: string[];
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}

export interface FeatureMapData {
  graph: GraphData;
  features: Record<string, Feature>;
}
