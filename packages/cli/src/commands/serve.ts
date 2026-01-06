import { randomBytes } from 'crypto';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { createServer } from '../server/createServer.js';
import { copyFeatureMapData, findWebPackagePath } from '../utils/featuremapWebSync.js';

interface ServeOptions {
  port: string;
  dev?: boolean;
  ws?: boolean;
}

export function createServeCommand(): Command {
  const command = new Command('serve');

  command
    .description('Serve the web UI, local API, and WebSocket updates')
    .option('-p, --port <port>', 'Port to run on', '3000')
    .option('--dev', 'Use Vite middleware for the web UI')
    .option('--no-ws', 'Disable WebSocket server')
    .action(async (options: ServeOptions) => {
      const port = parsePort(options.port);
      const projectRoot = process.cwd();
      const featuremapDir = path.join(projectRoot, '.featuremap');

      if (!fs.existsSync(featuremapDir)) {
        console.error('Error: .featuremap/ not found. Run "featuremap init" first.');
        process.exit(1);
      }

      if (options.dev) {
        const webPackagePath = findWebPackagePath();
        if (!webPackagePath) {
          throw new Error('Could not find @featuremap/web package.');
        }
        const webPublicData = path.join(webPackagePath, 'public', 'featuremap-data');
        await copyFeatureMapData(featuremapDir, webPublicData);
        console.log('Synced feature map data to web');
      }

      const sessionToken = randomBytes(24).toString('hex');

      try {
        const server = await createServer({
          projectRoot,
          port,
          dev: options.dev === true,
          enableWs: options.ws !== false,
          sessionToken,
        });

        console.log(`Session token: ${sessionToken}`);
        console.log(`Web UI: http://localhost:${port}`);
        console.log(`Health: http://localhost:${port}/api/health`);
        if (options.ws !== false) {
          console.log(`WebSocket: ws://localhost:${port}/ws`);
        }

        process.on('SIGINT', async () => {
          await server.close();
          process.exit(0);
        });
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : 'Failed to start server.'}`
        );
        process.exit(1);
      }
    });

  return command;
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);

  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    console.error(`Error: Invalid port "${value}".`);
    process.exit(1);
  }

  return port;
}
