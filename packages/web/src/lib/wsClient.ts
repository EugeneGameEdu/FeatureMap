export type FeaturemapWsMessage = {
  type: 'featuremap_changed';
  reason?: string;
  file?: string;
};

export function connectFeaturemapWs(
  onMessage: (message: FeaturemapWsMessage) => void
): () => void {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    return () => undefined;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}/ws`;
  const socket = new WebSocket(wsUrl);

  const handleMessage = (event: MessageEvent<string>) => {
    if (typeof event.data !== 'string') {
      return;
    }

    try {
      const parsed = JSON.parse(event.data) as FeaturemapWsMessage;
      if (parsed?.type === 'featuremap_changed') {
        onMessage(parsed);
      }
    } catch {
      // Ignore malformed payloads.
    }
  };

  socket.addEventListener('message', handleMessage);

  return () => {
    socket.removeEventListener('message', handleMessage);
    socket.close();
  };
}
