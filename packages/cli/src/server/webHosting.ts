import type { Express } from 'express';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

interface WebHostingOptions {
  projectRoot: string;
  dev: boolean;
  server?: import('http').Server;
}

export interface WebHostingHandle {
  close: () => Promise<void>;
}

export async function setupWebHosting(
  app: Express,
  options: WebHostingOptions
): Promise<WebHostingHandle> {
  const webRoot = resolveWebRoot(options.projectRoot);
  if (!webRoot) {
    throw new Error('Could not find @featuremap/web package.');
  }

  if (options.dev) {
    return setupViteHosting(app, webRoot, options.server);
  }

  const distPath = path.join(webRoot, 'dist');
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Missing web build at ${distPath}. Run "npm run build --workspace=@featuremap/web".`
    );
  }

  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });

  return { close: async () => undefined };
}

function resolveWebRoot(projectRoot: string): string | null {
  const workspacePath = path.resolve(projectRoot, 'packages', 'web');
  if (fs.existsSync(path.join(workspacePath, 'package.json'))) {
    return workspacePath;
  }

  try {
    const require = createRequire(import.meta.url);
    const resolved = require.resolve('@featuremap/web/package.json', {
      paths: [projectRoot],
    });
    return path.dirname(resolved);
  } catch {
    // ignore
  }

  const nodeModulesPath = path.resolve(projectRoot, 'node_modules', '@featuremap', 'web');
  if (fs.existsSync(path.join(nodeModulesPath, 'package.json'))) {
    return nodeModulesPath;
  }

  return null;
}

async function setupViteHosting(
  app: Express,
  webRoot: string,
  server?: import('http').Server
): Promise<WebHostingHandle> {
  const { createServer } = await import('vite');
  const originalCwd = process.cwd();

  if (originalCwd !== webRoot) {
    process.chdir(webRoot);
  }

  const viteServer = await createServer({
    root: webRoot,
    server: {
      middlewareMode: true,
      hmr: server ? { server } : undefined,
    },
    appType: 'custom',
  });

  app.use(viteServer.middlewares);
  app.use(async (req, res, next) => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    if (req.originalUrl.startsWith('/api')) {
      next();
      return;
    }

    const accept = req.headers.accept ?? '';
    if (!accept.includes('text/html')) {
      next();
      return;
    }

    try {
      const indexPath = path.join(webRoot, 'index.html');
      const html = await transformIndexHtml(viteServer, indexPath, req.originalUrl);
      res.status(200).setHeader('Content-Type', 'text/html').end(html);
    } catch (error) {
      if (error instanceof Error) {
        viteServer.ssrFixStacktrace(error);
      }
      next(error);
    }
  });

  return {
    close: async () => {
      await viteServer.close();
      if (process.cwd() !== originalCwd) {
        process.chdir(originalCwd);
      }
    },
  };
}

async function transformIndexHtml(
  viteServer: Awaited<ReturnType<typeof import('vite').createServer>>,
  indexPath: string,
  requestUrl: string
): Promise<string> {
  const raw = await fs.promises.readFile(indexPath, 'utf-8');
  return viteServer.transformIndexHtml(requestUrl, raw);
}
