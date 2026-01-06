import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { parse, stringify } from 'yaml';
import { GroupSchema, type GroupFile, type GroupLocks, type GroupMetadata } from '../types/group.js';
import { normalizeStringList } from './listUtils.js';

const GROUPS_DIR = 'groups';

export function getGroupsDir(featuremapDir: string): string {
  return join(featuremapDir, GROUPS_DIR);
}

export function getGroupPath(featuremapDir: string, groupId: string): string {
  return join(getGroupsDir(featuremapDir), `${groupId}.yaml`);
}

export function groupExists(groupPath: string): boolean {
  return existsSync(groupPath);
}

export function readGroupYaml(groupPath: string): GroupFile | null {
  if (!existsSync(groupPath)) {
    return null;
  }

  try {
    const content = readFileSync(groupPath, 'utf-8');
    const parsed = parse(content);
    const result = GroupSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function loadGroups(featuremapDir: string): Map<string, GroupFile> {
  const groups = new Map<string, GroupFile>();
  const groupsDir = getGroupsDir(featuremapDir);
  if (!existsSync(groupsDir)) {
    return groups;
  }

  const files = readdirSync(groupsDir).filter((file) => file.endsWith('.yaml'));
  for (const file of files) {
    const group = readGroupYaml(join(groupsDir, file));
    if (group) {
      groups.set(group.id, group);
    }
  }

  return groups;
}

export function buildGroupYaml(group: GroupFile): string {
  const validated = GroupSchema.parse(group);
  const normalized = normalizeGroupOutput(validated);
  return stringify(normalized, { lineWidth: 0 });
}

export function writeGroupYaml(featuremapDir: string, group: GroupFile): string {
  const groupPath = getGroupPath(featuremapDir, group.id);
  const content = buildGroupYaml(group);
  const groupsDir = getGroupsDir(featuremapDir);
  if (!existsSync(groupsDir)) {
    mkdirSync(groupsDir, { recursive: true });
  }
  atomicWriteFile(groupPath, content);
  return groupPath;
}

function normalizeGroupOutput(group: GroupFile): Record<string, unknown> {
  const featureIds = normalizeStringList(group.featureIds);
  const locks = normalizeLocks(group.locks);
  const metadata = normalizeMetadata(group.metadata);

  return {
    version: group.version,
    id: group.id,
    name: group.name,
    ...(group.description !== undefined ? { description: group.description } : {}),
    featureIds,
    source: group.source,
    ...(locks ? { locks } : {}),
    metadata,
  };
}

function normalizeLocks(locks?: GroupLocks): GroupLocks | undefined {
  if (!locks) {
    return undefined;
  }

  const normalized: GroupLocks = {};
  if (locks.name !== undefined) normalized.name = locks.name;
  if (locks.description !== undefined) normalized.description = locks.description;
  if (locks.featureIds !== undefined) normalized.featureIds = locks.featureIds;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeMetadata(metadata: GroupMetadata): GroupMetadata {
  return {
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    lastModifiedBy: metadata.lastModifiedBy,
    version: metadata.version,
  };
}

function atomicWriteFile(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp`;

  try {
    writeFileSync(tempPath, content, 'utf-8');
    renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch {
      // Best-effort cleanup only.
    }
    throw error;
  }
}
