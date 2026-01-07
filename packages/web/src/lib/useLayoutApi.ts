import { useCallback } from 'react';

const SESSION_TOKEN_KEY = 'featuremap-session-token';

export type LayoutApiErrorType =
  | 'token_missing'
  | 'forbidden'
  | 'bad_request'
  | 'network'
  | 'unknown';

export class LayoutApiError extends Error {
  type: LayoutApiErrorType;
  status?: number;

  constructor(type: LayoutApiErrorType, message: string, status?: number) {
    super(message);
    this.type = type;
    this.status = status;
  }
}

export interface LayoutUpdateResult {
  updated: boolean;
  positions: Record<string, { x: number; y: number }>;
}

function readSessionToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function useLayoutApi() {
  const updateLayoutPositions = useCallback(
    async (positions: Record<string, { x: number; y: number }>): Promise<LayoutUpdateResult> => {
      const token = readSessionToken();
      if (!token) {
        throw new LayoutApiError('token_missing', 'Invalid or missing token.');
      }

      let response: Response;
      try {
        response = await fetch('/api/layout/positions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-featuremap-token': token,
          },
          body: JSON.stringify({ positions }),
        });
      } catch {
        throw new LayoutApiError('network', 'Serve not running / API unavailable');
      }

      if (response.status === 403) {
        logApiError('/api/layout/positions', response.status, 'Forbidden');
        throw new LayoutApiError('forbidden', 'Invalid or missing token.', 403);
      }

      if (response.status === 400) {
        let message = 'Validation or permission error.';
        try {
          const body = (await response.json()) as { error?: string } | null;
          if (body?.error) {
            message = body.error;
          }
        } catch {
          // ignore parsing errors
        }
        logApiError('/api/layout/positions', response.status, message);
        throw new LayoutApiError('bad_request', message, 400);
      }

      if (!response.ok) {
        logApiError('/api/layout/positions', response.status, response.statusText);
        throw new LayoutApiError(
          'unknown',
          `Request failed (${response.status}).`,
          response.status
        );
      }

      try {
        return (await response.json()) as LayoutUpdateResult;
      } catch {
        return { updated: true, positions };
      }
    },
    []
  );

  return { updateLayoutPositions };
}

function logApiError(endpoint: string, status: number, message: string): void {
  console.error('API request failed', { endpoint, status, message });
}
