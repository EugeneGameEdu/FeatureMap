import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { GroupContainerNode as GroupContainerFlowNode } from '@/lib/groupContainers';

function GroupContainerNodeComponent({ data }: NodeProps<GroupContainerFlowNode>) {
  const { groupId, name, description, note, headerHeight, noteHeight, isSelected, onSelectGroup } =
    data;
  const hasNote = Boolean(note);

  return (
    <div className="w-full h-full rounded-xl border border-slate-200 bg-slate-50/70 shadow-sm relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelectGroup?.(groupId);
        }}
        className={`w-full text-left px-4 py-2 border-b border-slate-200/80 bg-white/80 rounded-t-xl ${
          isSelected ? 'ring-1 ring-blue-300' : ''
        }`}
        style={{ height: headerHeight }}
      >
        <div className="text-sm font-semibold text-slate-800 truncate">{name}</div>
        {description && (
          <div className="text-xs text-slate-500 truncate">{description}</div>
        )}
      </button>

      {hasNote && (
        <div
          className="absolute left-0 right-0 border-t border-slate-200/80 bg-slate-100/80 px-4 py-2 text-xs text-slate-600"
          style={{ height: noteHeight, bottom: 0 }}
        >
          <div
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {note}
          </div>
        </div>
      )}
    </div>
  );
}

export const GroupContainerNode = memo(GroupContainerNodeComponent);
