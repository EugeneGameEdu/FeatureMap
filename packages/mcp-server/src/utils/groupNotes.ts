import type { GroupFile } from '../types/group.js';

const NOTE_PREVIEW_LIMIT = 200;

export interface GroupNotePreview {
  groupId: string;
  notePreview: string;
  hasMore: boolean;
}

export function buildGroupSummaries(
  groupIds: string[],
  groupsById: Map<string, GroupFile>
): Array<{ id: string; name: string }> {
  return groupIds.map((groupId) => {
    const group = groupsById.get(groupId);
    return {
      id: groupId,
      name: group?.name ?? groupId,
    };
  });
}

export function buildGroupNotePreviews(
  groupIds: string[],
  groupsById: Map<string, GroupFile>
): GroupNotePreview[] {
  const previews: GroupNotePreview[] = [];

  for (const groupId of groupIds) {
    const note = groupsById.get(groupId)?.note;
    if (!note) {
      continue;
    }

    const notePreview = note.slice(0, NOTE_PREVIEW_LIMIT);
    const hasMore = note.length > NOTE_PREVIEW_LIMIT;
    previews.push({ groupId, notePreview, hasMore });
  }

  return previews;
}
