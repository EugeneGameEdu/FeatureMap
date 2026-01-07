import { useCallback } from 'react';

const SESSION_TOKEN_KEY = 'featuremap-session-token';

export type GroupApiErrorType =
  | 'token_missing'
  | 'forbidden'
  | 'bad_request'
  | 'network'
  | 'unknown';

export class GroupApiError extends Error {
  type: GroupApiErrorType;
  status?: number;

  constructor(type: GroupApiErrorType, message: string, status?: number) {
    super(message);
    this.type = type;
    this.status = status;
  }
}

export interface GroupNoteUpdateResult {
  updated: boolean;
  groupId: string;
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

export function useGroupApi() {
  const updateGroupNote = useCallback(
    async (groupId: string, note: string | null): Promise<GroupNoteUpdateResult> => {
      const token = readSessionToken();
      if (!token) {
        throw new GroupApiError('token_missing', 'Invalid or missing token.');
      }

      let response: Response;
      try {
        response = await fetch(`/api/groups/${groupId}/note`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-featuremap-token': token,
          },
          body: JSON.stringify({ note }),
        });
      } catch {
        throw new GroupApiError('network', 'Serve not running / API unavailable');
      }

      if (response.status === 403) {
        throw new GroupApiError('forbidden', 'Invalid or missing token.', 403);
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
        throw new GroupApiError('bad_request', message, 400);
      }

      if (!response.ok) {
        throw new GroupApiError(
          'unknown',
          `Request failed (${response.status}).`,
          response.status
        );
      }

      try {
        return (await response.json()) as GroupNoteUpdateResult;
      } catch {
        return { updated: true, groupId };
      }
    },
    []
  );

  return { updateGroupNote };
}
