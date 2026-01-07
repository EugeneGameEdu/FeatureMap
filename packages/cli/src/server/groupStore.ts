import * as fs from 'fs';
import * as path from 'path';
import { GroupSchema, type Group } from '../types/index.js';
import { loadYAML, saveYAML } from '../utils/yaml-loader.js';

export function updateGroupNote(
  projectRoot: string,
  groupId: string,
  note: string | null | undefined
): Group {
  const featuremapDir = path.resolve(projectRoot, '.featuremap');
  const groupsDir = path.resolve(featuremapDir, 'groups');
  const groupPath = path.resolve(groupsDir, `${groupId}.yaml`);

  if (!fs.existsSync(featuremapDir)) {
    throw new Error('Missing .featuremap/ directory.');
  }

  const relativePath = path.relative(groupsDir, groupPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid group id.');
  }

  if (!fs.existsSync(groupPath)) {
    throw new Error('Group not found.');
  }

  const existing = loadYAML(groupPath, GroupSchema, { fileType: 'group' });
  const trimmed = typeof note === 'string' ? note.trimEnd() : note;
  const nextNote = trimmed && trimmed.length > 0 ? trimmed : undefined;
  const next: Group = {
    ...existing,
    ...(nextNote !== undefined ? { note: nextNote } : {}),
    metadata: {
      ...existing.metadata,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: 'user',
    },
  };

  if (nextNote === undefined && 'note' in next) {
    delete next.note;
  }

  saveYAML(groupPath, next, GroupSchema);
  return next;
}
