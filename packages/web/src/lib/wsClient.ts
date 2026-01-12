export type FeaturemapWsMessage = {
  type: 'featuremap_changed';
  reason?: string;
  file?: string;
};

type HealthResponse = {
  ok?: boolean;
  ws?: boolean;
};

export function connectFeaturemapWs(
  onMessage: (message: FeaturemapWsMessage) => void
): () => void {
  if (
    typeof window === 'undefined' ||
    typeof WebSocket === 'undefined' ||
    typeof fetch === 'undefined'
  ) {
    return () => undefined;
  }

  const controller = new AbortController();
  let socket: WebSocket | null = null;

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

  const openSocket = () => {
    if (controller.signal.aborted) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws`;
    socket = new WebSocket(wsUrl);
    socket.addEventListener('message', handleMessage);
  };

  const checkHealth = async () => {
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const healthUrl = `${protocol}://${window.location.host}/api/health`;

    try {
      const response = await fetch(healthUrl, { signal: controller.signal });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as HealthResponse | null;
      if (payload?.ws === false) {
        return;
      }
      openSocket();
    } catch {
      // Ignore missing or unavailable API.
    }
  };

  void checkHealth();

  return () => {
    controller.abort();
    if (socket) {
      socket.removeEventListener('message', handleMessage);
      socket.close();
    }
  };
}
