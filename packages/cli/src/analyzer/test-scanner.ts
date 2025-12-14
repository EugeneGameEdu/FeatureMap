import { scanProject, getRelativePath } from './scanner.js';
import * as path from 'path';

async function main() {
  // Сканируем корень FeatureMap проекта (на 2 уровня выше cli)
  const projectRoot = path.resolve(process.cwd(), '../..');
  
  console.log('Scanning project:', projectRoot);
  
  try {
    const result = await scanProject(projectRoot);
    
    console.log('\nProject:', result.config.project.name);
    console.log('Files found:', result.files.length);
    console.log('\nFiles:');
    
    for (const file of result.files) {
      const relativePath = getRelativePath(file, result.projectRoot);
      console.log(' ', relativePath);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
