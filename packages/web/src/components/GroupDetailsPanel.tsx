import { AlertTriangle, Layers, Tag, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { GroupSummary, ViewMode } from '@/lib/types';
import type { GroupMember } from '@/lib/groupMembership';

interface GroupDetailsPanelProps {
  group: GroupSummary;
  groupMembers: GroupMember[];
  viewMode: ViewMode;
  onClose: () => void;
}

export function GroupDetailsPanel({
  group,
  groupMembers,
  viewMode,
  onClose,
}: GroupDetailsPanelProps) {
  const memberLabel = viewMode === 'features' ? 'Features' : 'Clusters';

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
            {group.note ? (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{group.note}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No note yet.</p>
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
