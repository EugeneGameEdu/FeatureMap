import * as path from 'path';
import { DependencyGraph } from './graph.js';

export interface Cluster {
  id: string;                    // unique ID derived from path
  name: string;                  // human readable name
  files: string[];               // files in the cluster
  internalDependencies: string[]; // dependencies within the cluster
  externalDependencies: string[]; // dependencies on other clusters
}

export interface GroupingResult {
  clusters: Cluster[];
  fileToCluster: Record<string, string>;  // file -> clusterId
}

/**
 * Groups files by folders.
 * Logic: each folder inside packages/<pkg>/src becomes a cluster.
 * Files in src/ root are grouped into "<package>-core".
 */
export function groupByFolders(graph: DependencyGraph): GroupingResult {
  const fileToCluster: Record<string, string> = {};
  const clusterFiles: Record<string, string[]> = {};

  // Step 1: determine cluster for each file
  for (const filePath of Object.keys(graph.files)) {
    const clusterId = getClusterId(filePath);
    fileToCluster[filePath] = clusterId;

    if (!clusterFiles[clusterId]) {
      clusterFiles[clusterId] = [];
    }
    clusterFiles[clusterId].push(filePath);
  }

  // Step 2: build cluster objects with dependencies
  const clusters: Cluster[] = [];

  for (const [clusterId, files] of Object.entries(clusterFiles)) {
    const internalDeps = new Set<string>();
    const externalDeps = new Set<string>();

    for (const file of files) {
      const deps = graph.dependencies[file] || [];
      
      for (const dep of deps) {
        const depCluster = fileToCluster[dep];
        
        if (depCluster === clusterId) {
          internalDeps.add(dep);
        } else if (depCluster) {
          externalDeps.add(depCluster);
        }
      }
    }

    clusters.push({
      id: clusterId,
      name: generateClusterName(clusterId),
      files: files.sort(),
      internalDependencies: [...internalDeps].sort(),
      externalDependencies: [...externalDeps].sort(),
    });
  }

  clusters.sort((a, b) => a.id.localeCompare(b.id));

  return { clusters, fileToCluster };
}

/**
 * Determines cluster ID for a file.
 * Examples:
 *   packages/cli/src/commands/init.ts -> cli-commands
 *   packages/cli/src/analyzer/parser.ts -> cli-analyzer
 *   packages/cli/src/index.ts -> cli-core
 *   packages/web/src/components/ui/button.tsx -> web-components-ui
 *   packages/web/src/App.tsx -> web-core
 */
function getClusterId(filePath: string): string {
  const parts = filePath.split('/');
  
  const packagesIndex = parts.indexOf('packages');
  if (packagesIndex === -1 || parts.length < packagesIndex + 4) {
    return parts.slice(0, 2).join('-') || 'root';
  }

  const packageName = parts[packagesIndex + 1]; // cli, web, mcp-server
  const srcIndex = packagesIndex + 3; // after packages/*/src/
  
  // file directly in src/
  if (srcIndex >= parts.length - 1) {
    return `${packageName}-core`;
  }

  const folderAfterSrc = parts[srcIndex];
  
  if (srcIndex + 1 < parts.length - 1) {
    const secondFolder = parts[srcIndex + 1];
    if (!secondFolder.includes('.')) {
      return `${packageName}-${folderAfterSrc}-${secondFolder}`;
    }
  }

  return `${packageName}-${folderAfterSrc}`;
}

/**
 * Generates human readable name from ID.
 * cli-commands -> CLI Commands
 * web-components-ui -> Web Components UI
 */
function generateClusterName(clusterId: string): string {
  return clusterId
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getClusterStats(result: GroupingResult): {
  totalClusters: number;
  avgFilesPerCluster: number;
  largestCluster: { id: string; size: number } | null;
} {
  const { clusters } = result;
  const totalClusters = clusters.length;
  const totalFiles = clusters.reduce((sum, c) => sum + c.files.length, 0);
  
  let largestCluster: { id: string; size: number } | null = null;
  for (const cluster of clusters) {
    if (!largestCluster || cluster.files.length > largestCluster.size) {
      largestCluster = { id: cluster.id, size: cluster.files.length };
    }
  }

  return {
    totalClusters,
    avgFilesPerCluster: totalClusters > 0 ? totalFiles / totalClusters : 0,
    largestCluster,
  };
}
