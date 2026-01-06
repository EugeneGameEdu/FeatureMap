import { spawn } from 'child_process';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { copyFeatureMapData, findWebPackagePath } from '../utils/featuremapWebSync.js';

export function createWebCommand(): Command {
  const command = new Command('web');

  command
    .description('Start web interface')
    .option('-p, --port <port>', 'Port to run on', '3000')
    .option('--no-open', 'Do not open browser automatically')
    .action(async (options) => {
      const projectRoot = process.cwd();
      const featuremapDir = path.join(projectRoot, '.featuremap');

      if (!fs.existsSync(featuremapDir)) {
        console.error('❌ .featuremap/ not found. Run "featuremap init" first.');
        process.exit(1);
      }

      const graphPath = path.join(featuremapDir, 'graph.yaml');
      if (!fs.existsSync(graphPath)) {
        console.error('❌ graph.yaml not found. Run "featuremap scan" first.');
        process.exit(1);
      }

      const webPackagePath = findWebPackagePath();
      if (!webPackagePath) {
        console.error('❌ Could not find @featuremap/web package.');
        process.exit(1);
      }

      const webPublicData = path.join(webPackagePath, 'public', 'featuremap-data');
      await copyFeatureMapData(featuremapDir, webPublicData);
      console.log('✓ Copied feature map data to web');

      console.log(`\nStarting web interface on port ${options.port}...`);

      const viteProcess = spawn('npm', ['run', 'dev', '--', '--port', options.port], {
        cwd: webPackagePath,
        stdio: 'inherit',
        shell: true,
      });

      viteProcess.on('error', (error) => {
        console.error('Failed to start web server:', error);
        process.exit(1);
      });

      if (options.open !== false) {
        setTimeout(() => {
          const url = `http://localhost:${options.port}`;
          openBrowser(url);
        }, 2000);
      }

      process.on('SIGINT', () => {
        viteProcess.kill();
        process.exit(0);
      });
    });

  return command;
}
function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;

  switch (platform) {
    case 'win32':
      command = `start ${url}`;
      break;
    case 'darwin':
      command = `open ${url}`;
      break;
    default:
      command = `xdg-open ${url}`;
  }

  spawn(command, [], { shell: true, stdio: 'ignore' });
}
