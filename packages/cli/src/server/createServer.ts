import * as http from 'http';
import type { Server } from 'http';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { createContextUpdateHandler } from './routes/contextUpdate.js';
import { createCommentsRouter } from './routes/commentsRoutes.js';
import { createGroupRouter } from './routes/groupRoutes.js';
import { createLayoutRouter } from './routes/layoutRoutes.js';
import { enforceLocalhost, requireToken } from './security.js';
import { createWsHub } from './wsHub.js';
import type { WsHub } from './wsHub.js';
import { setupWebHosting } from './webHosting.js';

interface CreateServerOptions {
  projectRoot: string;
  port: number;
  dev: boolean;
  enableWs: boolean;
  sessionToken: string;
}

export interface FeaturemapServer {
  server: Server;
  wsHub: WsHub | null;
  close: () => Promise<void>;
}

export async function createServer(options: CreateServerOptions): Promise<FeaturemapServer> {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(express.json({ limit: '1mb' }));
  app.use(enforceLocalhost);

  let wsHub: WsHub | null = null;
  const apiRouter = express.Router();
  apiRouter.get('/health', (_req, res) => {
    res.json({ ok: true, ws: Boolean(wsHub) });
  });

  const server = http.createServer(app);
  wsHub = options.enableWs ? createWsHub(server) : null;
  const contextUpdateHandler = createContextUpdateHandler({
    projectRoot: options.projectRoot,
    wsHub,
  });

  apiRouter.post('/context/update', requireToken(options.sessionToken), contextUpdateHandler);
  apiRouter.use(
    '/comments',
    createCommentsRouter({
      projectRoot: options.projectRoot,
      sessionToken: options.sessionToken,
      wsHub,
    })
  );
  apiRouter.use(
    '/layout',
    createLayoutRouter({
      projectRoot: options.projectRoot,
      sessionToken: options.sessionToken,
      wsHub,
    })
  );
  apiRouter.use(
    '/groups',
    createGroupRouter({
      projectRoot: options.projectRoot,
      sessionToken: options.sessionToken,
      wsHub,
    })
  );
  app.use('/api', apiRouter);
  app.get('/featuremap-data/groups/index.yaml', (_req, res) => {
    const indexPath = path.join(options.projectRoot, '.featuremap', 'groups', 'index.yaml');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
      return;
    }
    const groupsDir = path.join(options.projectRoot, '.featuremap', 'groups');
    if (fs.existsSync(groupsDir)) {
      const files = fs
        .readdirSync(groupsDir)
        .filter((file) => file.endsWith('.yaml') && file !== 'index.yaml');
      const groupIds = files
        .map((file) => path.basename(file, '.yaml'))
        .sort((a, b) => a.localeCompare(b));
      if (groupIds.length > 0) {
        const yaml = `version: 1\ngroups:\n${groupIds
          .map((id) => `  - ${id}`)
          .join('\n')}\n`;
        res.type('text/yaml').send(yaml);
        return;
      }
    }
    res.type('text/yaml').send('version: 1\ngroups: []\n');
  });
  app.get('/featuremap-data/comments/index.yaml', (_req, res) => {
    const indexPath = path.join(options.projectRoot, '.featuremap', 'comments', 'index.yaml');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
      return;
    }
    const commentsDir = path.join(options.projectRoot, '.featuremap', 'comments');
    if (fs.existsSync(commentsDir)) {
      const files = fs
        .readdirSync(commentsDir)
        .filter((file) => file.endsWith('.yaml') && file !== 'index.yaml');
      const commentIds = files
        .map((file) => path.basename(file, '.yaml'))
        .sort((a, b) => a.localeCompare(b));
      if (commentIds.length > 0) {
        const yaml = `version: 1\ncomments:\n${commentIds
          .map((id) => `  - ${id}`)
          .join('\n')}\n`;
        res.type('text/yaml').send(yaml);
        return;
      }
    }
    res.type('text/yaml').send('version: 1\ncomments: []\n');
  });
  app.use('/featuremap-data', express.static(path.join(options.projectRoot, '.featuremap')));

  const webHosting = await setupWebHosting(app, {
    projectRoot: options.projectRoot,
    dev: options.dev,
    server,
  });

  await listen(server, options.port);

  const close = async (): Promise<void> => {
    await webHosting.close();
    if (wsHub) {
      await wsHub.close();
    }
    await closeServer(server);
  };

  return { server, wsHub, close };
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      reject(error);
    };

    const onListening = (): void => {
      server.off('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
