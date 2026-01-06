import { useCallback, useState } from 'react';

const SESSION_TOKEN_KEY = 'featuremap-session-token';

export type ContextApiErrorType =
  | 'token_missing'
  | 'forbidden'
  | 'bad_request'
  | 'network'
  | 'unknown';

export class ContextApiError extends Error {
  type: ContextApiErrorType;
  status?: number;

  constructor(type: ContextApiErrorType, message: string, status?: number) {
    super(message);
    this.type = type;
    this.status = status;
  }
}

export interface ContextUpdateResult {
  updated: boolean;
  file: string;
  written?: boolean;
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

function writeSessionToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors.
  }
}

export function useContextApi() {
  const [token, setTokenState] = useState<string>(() => readSessionToken());

  const setToken = useCallback((value: string) => {
    const trimmed = value.trim();
    setTokenState(trimmed);
    writeSessionToken(trimmed);
  }, []);

  const updateContextFile = useCallback(
    async (file: string, data: unknown): Promise<ContextUpdateResult> => {
      if (!token) {
        throw new ContextApiError('token_missing', 'Invalid or missing token.');
      }

      let response: Response;
      try {
        response = await fetch('/api/context/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-featuremap-token': token,
          },
          body: JSON.stringify({ file, data }),
        });
      } catch {
        throw new ContextApiError('network', 'Serve not running / API unavailable');
      }

      if (response.status === 403) {
        throw new ContextApiError('forbidden', 'Invalid or missing token.', 403);
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
        throw new ContextApiError('bad_request', message, 400);
      }

      if (!response.ok) {
        throw new ContextApiError(
          'unknown',
          `Request failed (${response.status}).`,
          response.status
        );
      }

      try {
        return (await response.json()) as ContextUpdateResult;
      } catch {
        return { updated: true, file };
      }
    },
    [token]
  );

  return { token, setToken, updateContextFile };
}
