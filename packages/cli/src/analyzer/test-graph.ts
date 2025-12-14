import { scanProject } from './scanner.js';
import { buildGraph, getGraphStats } from './graph.js';
import * as path from 'path';

async function main() {
  const projectRoot = path.resolve(process.cwd(), '../..');
  
  console.log('Building dependency graph...\n');
  
  try {
    const scanResult = await scanProject(projectRoot);
    const graph = await buildGraph(scanResult);
    const stats = getGraphStats(graph);
    
    console.log('=== Graph Statistics ===');
    console.log(`Total files: ${stats.totalFiles}`);
    console.log(`Total dependencies: ${stats.totalDependencies}`);
    console.log(`Total exports: ${stats.totalExports}`);
    console.log(`Avg dependencies per file: ${stats.avgDependencies.toFixed(2)}`);
    
    console.log('\n=== Dependencies ===');
    for (const [file, deps] of Object.entries(graph.dependencies)) {
      if (deps.length > 0) {
        console.log(`\n${file}:`);
        for (const dep of deps) {
          console.log(`  → ${dep}`);
        }
      }
    }
    
    console.log('\n=== Files with most dependents (most imported) ===');
    const byDependents = Object.entries(graph.dependents)
      .map(([file, deps]) => ({ file, count: deps.length }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    for (const { file, count } of byDependents) {
      console.log(`  ${file}: ${count} dependents`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
