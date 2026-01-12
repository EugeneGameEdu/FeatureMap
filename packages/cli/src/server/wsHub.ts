import type { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { isLocalhostRequest } from './security.js';

export type FeaturemapWsMessage = {
  type: 'featuremap_changed';
  reason: 'context_updated' | 'comments_updated' | 'groups_updated' | 'layout_updated';
  file: string;
};

export interface WsHub {
  handleUpgrade: (req: import('http').IncomingMessage, socket: import('net').Socket, head: Buffer) => void;
  broadcast: (message: FeaturemapWsMessage) => void;
  close: () => Promise<void>;
}

export function createWsHub(server: Server): WsHub {
  const wss = new WebSocketServer({
    noServer: true,
    verifyClient: (info, done) => {
      if (!isLocalhostRequest(info.req.headers)) {
        done(false, 403, 'Forbidden');
        return;
      }
      done(true);
    },
  });
  const sockets = new Set<WebSocket>();

  wss.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => {
      sockets.delete(socket);
    });
  });

  const broadcast = (message: FeaturemapWsMessage): void => {
    const payload = JSON.stringify(message);

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  };

  const handleUpgrade = (req: import('http').IncomingMessage, socket: import('net').Socket, head: Buffer): void => {
    const url = req.url ?? '';
    const path = url.split('?')[0];
    if (path !== '/ws') {
      return;
    }
    wss.handleUpgrade(req, socket, head, (client) => {
      wss.emit('connection', client, req);
    });
  };

  const close = (): Promise<void> =>
    new Promise((resolve, reject) => {
      wss.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  return { handleUpgrade, broadcast, close };
}
