import { useCallback } from 'react';
import type { CommentLink, CommentNode, CommentPosition } from './commentTypes';

const SESSION_TOKEN_KEY = 'featuremap-session-token';

export type CommentsApiErrorType =
  | 'token_missing'
  | 'forbidden'
  | 'bad_request'
  | 'network'
  | 'unknown';

export class CommentsApiError extends Error {
  type: CommentsApiErrorType;
  status?: number;

  constructor(type: CommentsApiErrorType, message: string, status?: number) {
    super(message);
    this.type = type;
    this.status = status;
  }
}

export interface CommentUpsertPayload {
  id?: string;
  content: string;
  position: CommentPosition;
  links: CommentLink[];
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  author?: string;
  createdAt?: string;
  updatedAt?: string;
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

export function useCommentsApi() {
  const upsertComment = useCallback(async (payload: CommentUpsertPayload): Promise<CommentNode> => {
    const token = readSessionToken();
    if (!token) {
      throw new CommentsApiError('token_missing', 'Invalid or missing token.');
    }

    let response: Response;
    try {
      response = await fetch('/api/comments/upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-featuremap-token': token,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new CommentsApiError('network', 'Serve not running / API unavailable');
    }

    if (response.status === 403) {
      throw new CommentsApiError('forbidden', 'Invalid or missing token.', 403);
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
      throw new CommentsApiError('bad_request', message, 400);
    }

    if (!response.ok) {
      throw new CommentsApiError(
        'unknown',
        `Request failed (${response.status}).`,
        response.status
      );
    }

    try {
      return (await response.json()) as CommentNode;
    } catch {
      throw new CommentsApiError('unknown', 'Invalid response from server.');
    }
  }, []);

  return { upsertComment };
}
