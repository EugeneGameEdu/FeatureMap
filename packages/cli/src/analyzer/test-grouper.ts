import { scanProject } from './scanner.js';
import { buildGraph } from './graph.js';
import { groupByFolders, getClusterStats } from './grouper.js';
import * as path from 'path';

async function main() {
  const projectRoot = path.resolve(process.cwd(), '../..');
  
  console.log('Grouping files into clusters...\n');
  
  try {
    const scanResult = await scanProject(projectRoot);
    const graph = await buildGraph(scanResult);
    const grouping = groupByFolders(graph);
    const stats = getClusterStats(grouping);
    
    console.log('=== Cluster Statistics ===');
    console.log(`Total clusters: ${stats.totalClusters}`);
    console.log(`Avg files per cluster: ${stats.avgFilesPerCluster.toFixed(2)}`);
    if (stats.largestCluster) {
      console.log(`Largest cluster: ${stats.largestCluster.id} (${stats.largestCluster.size} files)`);
    }
    
    console.log('\n=== Clusters ===');
    for (const cluster of grouping.clusters) {
      console.log(`\n[${cluster.id}] ${cluster.name}`);
      console.log(`  Files (${cluster.files.length}):`);
      for (const file of cluster.files) {
        const shortPath = file.split('/').slice(-2).join('/');
        console.log(`    - ${shortPath}`);
      }
      
      if (cluster.externalDependencies.length > 0) {
        console.log(`  Depends on: ${cluster.externalDependencies.join(', ')}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
