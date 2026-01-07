import { useEffect, useState } from 'react';
import { AlertTriangle, Layers, Tag, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { GroupSummary, ViewMode } from '@/lib/types';
import type { GroupMember } from '@/lib/groupMembership';
import { GroupApiError, useGroupApi } from '@/lib/useGroupApi';

interface GroupDetailsPanelProps {
  group: GroupSummary;
  groupMembers: GroupMember[];
  viewMode: ViewMode;
  onClose: () => void;
  onGroupUpdated?: () => void;
}

export function GroupDetailsPanel({
  group,
  groupMembers,
  viewMode,
  onClose,
  onGroupUpdated,
}: GroupDetailsPanelProps) {
  const memberLabel = viewMode === 'features' ? 'Features' : 'Clusters';
  const { updateGroupNote } = useGroupApi();
  const [isEditing, setIsEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState(group.note ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setNoteDraft(group.note ?? '');
    setSaveError(null);
  }, [group.id]);

  useEffect(() => {
    if (!isEditing) {
      setNoteDraft(group.note ?? '');
    }
  }, [group.note, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const trimmed = noteDraft.trimEnd();
      await updateGroupNote(group.id, trimmed.length > 0 ? trimmed : null);
      setIsEditing(false);
      onGroupUpdated?.();
    } catch (error) {
      setSaveError(formatGroupError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNoteDraft(group.note ?? '');
    setIsEditing(false);
    setSaveError(null);
  };

  return (
    <div className="w-[350px] border-l bg-white flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-2">
            <h2 className="font-semibold text-gray-900">{group.name}</h2>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                group
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X size={16} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {group.description ? (
            <section>
              <p className="text-sm text-gray-600">{group.description}</p>
            </section>
          ) : (
            <section>
              <p className="text-sm text-gray-400 italic">
                No description yet.
              </p>
            </section>
          )}

          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Tag size={16} />
              Note
            </h3>
            {!isEditing ? (
              <div className="space-y-2">
                {group.note ? (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{group.note}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No note yet.</p>
                )}
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  Edit note
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                />
                {saveError && <div className="text-xs text-red-600">{saveError}</div>}
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Layers size={16} />
              {memberLabel} ({groupMembers.length})
            </h3>
            {groupMembers.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No members visible.</p>
            ) : (
              <div className="space-y-2">
                {groupMembers.map((member) => (
                  <div
                    key={member.id}
                    className="rounded border border-gray-100 bg-gray-50 px-2 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm text-gray-800">
                        {member.label}
                        <div className="text-xs text-gray-500 font-mono">{member.id}</div>
                      </div>
                      {member.missing && (
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                          <AlertTriangle size={12} className="mr-1" />
                          missing
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function formatGroupError(error: unknown): string {
  if (error instanceof GroupApiError) {
    if (error.type === 'token_missing' || error.type === 'forbidden') {
      return 'Token required to save group notes (run featuremap serve and paste token).';
    }
    if (error.type === 'network') {
      return 'Serve not running / API unavailable.';
    }
    return error.message;
  }
  return 'Failed to save group note.';
}
