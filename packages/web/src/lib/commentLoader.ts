import { CommentIndexSchema, CommentNodeSchema } from './commentSchema';
import type { CommentNode } from './commentTypes';
import { parseYamlWithSchema } from './yamlParsing';

const DATA_BASE_URL = '/featuremap-data';

export async function loadComments(): Promise<CommentNode[]> {
  const commentIds = await loadCommentIndex();
  if (commentIds.length === 0) {
    return [];
  }

  const commentsById = await loadCommentsById(new Set(commentIds));
  return sortComments([...commentsById.values()]);
}

async function loadCommentIndex(): Promise<string[]> {
  const response = await fetch(`${DATA_BASE_URL}/comments/index.yaml`);

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Failed to load comments index: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (looksLikeHtml(text, contentType)) {
    return [];
  }

  try {
    const parsed = parseYamlWithSchema(text, CommentIndexSchema, 'comments/index.yaml');
    return normalizeStringList(parsed.comments);
  } catch (error) {
    console.warn('Failed to parse comments/index.yaml:', error);
    return [];
  }
}

async function loadCommentYaml(commentId: string): Promise<CommentNode> {
  const response = await fetch(`${DATA_BASE_URL}/comments/${commentId}.yaml`);

  if (!response.ok) {
    throw new Error(`Failed to load comment ${commentId}: ${response.statusText}`);
  }

  const text = await response.text();
  return parseYamlWithSchema(text, CommentNodeSchema, `comments/${commentId}.yaml`);
}

async function loadCommentsById(ids: Set<string>): Promise<Map<string, CommentNode>> {
  const comments = new Map<string, CommentNode>();
  await Promise.all(
    [...ids].map(async (commentId) => {
      const comment = await loadCommentYamlSafe(commentId);
      if (comment) {
        comments.set(commentId, comment);
      }
    })
  );
  return comments;
}

async function loadCommentYamlSafe(commentId: string): Promise<CommentNode | null> {
  try {
    return await loadCommentYaml(commentId);
  } catch (error) {
    console.warn(`Failed to load comment ${commentId}:`, error);
    return null;
  }
}

function sortComments(comments: CommentNode[]): CommentNode[] {
  return [...comments].sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeStringList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function looksLikeHtml(text: string, contentType: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  if (contentType.includes('text/html')) {
    return true;
  }
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<head');
}
