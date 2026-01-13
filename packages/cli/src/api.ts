export { scanProject } from './analyzer/scanner.js';
export { scanProjectStructure } from './analyzer/structure-scanner.js';
export { buildGraph, getGraphStats } from './analyzer/graph.js';
export { groupByFolders } from './analyzer/grouper.js';
export { loadExistingClusters } from './analyzer/cluster-loader.js';
export { applyClusterMatching } from './analyzer/cluster-id-matching.js';
export { detectTechStack } from './analyzer/tech-stack-detector.js';
export { detectConventions } from './analyzer/conventions-detector.js';
export { detectStatistics } from './analyzer/statistics-detector.js';
export { detectStructureContext } from './analyzer/structure-detector.js';
export { detectTesting } from './analyzer/testing-detector.js';
export { buildClusterFile } from './utils/cluster-builder.js';
export {
  buildUpdatedMetadata,
  areClustersEquivalent,
  areGraphsEquivalent,
} from './utils/scanCompare.js';
export { buildDefaultLayout } from './utils/layout-builder.js';
export { saveGraphYaml } from './utils/graphYaml.js';
export {
  buildConventionsInput,
  countFeatureFiles,
  findGoModPaths,
  findPackageJsonPaths,
  saveAutoContext,
} from './utils/contextUtils.js';
export { saveYAML, loadYAML, writeYamlTemplate } from './utils/yaml-loader.js';
export { buildContextTemplates } from './utils/contextTemplates.js';
export { SUPPORTED_VERSIONS } from './constants/versions.js';
export {
  ClusterSchema,
  ConventionsSchema,
  GraphSchema,
  LayoutSchema,
  StatisticsSchema,
  StructureSchema,
  TestingSchema,
  TechStackSchema,
} from './types/index.js';

export type { DependencyGraph } from './analyzer/graph.js';
export type { Cluster as FolderCluster } from './analyzer/grouper.js';
export type { Cluster as ClusterFile, Graph, Layer } from './types/index.js';
