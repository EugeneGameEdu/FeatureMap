import type { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { isLocalhostRequest } from './security.js';

export type FeaturemapWsMessage = {
  type: 'featuremap_changed';
  reason: 'context_updated' | 'comments_updated';
  file: string;
};

export interface WsHub {
  broadcast: (message: FeaturemapWsMessage) => void;
  close: () => Promise<void>;
}

export function createWsHub(server: Server): WsHub {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
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

  return { broadcast, close };
}
