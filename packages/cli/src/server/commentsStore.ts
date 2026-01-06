import * as fs from 'fs';
import * as path from 'path';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import { CommentNodeSchema, type CommentLink, type CommentNode } from '../types/index.js';
import { loadYAML, saveYAML } from '../utils/yaml-loader.js';

const COMMENT_FILE_PREFIX = 'comment-';
const INDEX_FILE = 'index.yaml';
const DRAFT_PREFIX = 'draft-';
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export interface CommentUpsertInput {
  id?: string;
  content?: string;
  position?: { x: number; y: number };
  links?: CommentLink[];
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function listComments(projectRoot: string): CommentNode[] {
  const commentsDir = getCommentsDir(projectRoot);

  if (!fs.existsSync(commentsDir)) {
    return [];
  }

  const files = fs
    .readdirSync(commentsDir)
    .filter((file) => file.endsWith('.yaml') && file !== INDEX_FILE);

  const comments: CommentNode[] = [];
  for (const file of files) {
    const filePath = path.join(commentsDir, file);
    try {
      const comment = loadYAML(filePath, CommentNodeSchema, { fileType: 'comment' });
      comments.push(comment);
    } catch (error) {
      console.warn(`Skipping invalid comment file ${filePath}:`, error);
    }
  }

  return comments.sort((a, b) => a.id.localeCompare(b.id));
}

export function upsertComment(projectRoot: string, input: CommentUpsertInput): CommentNode {
  const commentsDir = ensureCommentsDir(projectRoot);
  const existingComments = listComments(projectRoot);
  const existingIds = new Set(existingComments.map((comment) => comment.id));

  const requestedId =
    input.id && !isDraftId(input.id) && KEBAB_CASE_REGEX.test(input.id) ? input.id : undefined;
  const existing = requestedId
    ? existingComments.find((comment) => comment.id === requestedId)
    : undefined;

  const content = input.content ?? existing?.content;
  const position = input.position ?? existing?.position;
  const links = input.links ?? existing?.links;

  if (!content || !position || !links) {
    throw new Error('Missing required comment fields (content, position, links).');
  }

  const finalId = existing?.id ?? requestedId ?? generateCommentId(content, existingIds);
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? existing?.createdAt ?? now;
  const updatedAt = input.updatedAt ?? now;
  const tags =
    input.tags === undefined ? normalizeStringList(existing?.tags) : normalizeStringList(input.tags);
  const priority = input.priority ?? existing?.priority;
  const author = input.author ?? existing?.author;

  const comment: CommentNode = {
    version: SUPPORTED_VERSIONS.comment,
    id: finalId,
    content,
    position,
    links: sortLinks(links),
    ...(tags.length > 0 ? { tags } : {}),
    ...(priority ? { priority } : {}),
    ...(author ? { author } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };

  const filePath = path.join(commentsDir, `${COMMENT_FILE_PREFIX}${finalId}.yaml`);
  saveYAML(filePath, comment, CommentNodeSchema, {
    sortArrayFields: ['tags'],
  });

  return comment;
}

export function deleteComment(projectRoot: string, id: string): void {
  if (!KEBAB_CASE_REGEX.test(id)) {
    throw new Error('Invalid comment id.');
  }

  const commentsDir = getCommentsDir(projectRoot);
  const filePath = path.join(commentsDir, `${COMMENT_FILE_PREFIX}${id}.yaml`);

  if (!fs.existsSync(filePath)) {
    throw new Error('Comment not found.');
  }

  fs.unlinkSync(filePath);
}

function getCommentsDir(projectRoot: string): string {
  return path.join(projectRoot, '.featuremap', 'comments');
}

function ensureCommentsDir(projectRoot: string): string {
  const commentsDir = getCommentsDir(projectRoot);
  if (!fs.existsSync(commentsDir)) {
    fs.mkdirSync(commentsDir, { recursive: true });
  }
  return commentsDir;
}

function isDraftId(id: string): boolean {
  return id.startsWith(DRAFT_PREFIX);
}

function generateCommentId(content: string, existingIds: Set<string>): string {
  const firstLine = content.split('\n').find((line) => line.trim().length > 0) ?? '';
  let candidate = slugify(firstLine);

  if (!candidate) {
    candidate = `comment-${Date.now()}`;
  }

  if (!KEBAB_CASE_REGEX.test(candidate)) {
    candidate = `comment-${candidate}`;
  }

  if (!KEBAB_CASE_REGEX.test(candidate)) {
    candidate = `comment-${Date.now()}`;
  }

  if (!existingIds.has(candidate)) {
    return candidate;
  }

  let index = 2;
  while (existingIds.has(`${candidate}-${index}`)) {
    index += 1;
  }
  return `${candidate}-${index}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

function sortLinks(links: CommentLink[]): CommentLink[] {
  return [...links].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    return a.id.localeCompare(b.id);
  });
}

function normalizeStringList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}
