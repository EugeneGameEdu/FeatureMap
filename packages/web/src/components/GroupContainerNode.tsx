import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { GroupContainerNode as GroupContainerFlowNode } from '@/lib/groupContainers';

function GroupContainerNodeComponent({ data }: NodeProps<GroupContainerFlowNode>) {
  const { groupId, name, description, note, headerHeight, noteHeight, isSelected, onSelectGroup } =
    data;
  const hasNote = Boolean(note);

  const headerClassName = `group-container__header pointer-events-auto w-full text-left px-4 py-2 border-b border-border bg-card/80 rounded-t-xl whitespace-normal break-words ${
    isSelected ? 'ring-1 ring-primary/60 cursor-grab active:cursor-grabbing' : 'cursor-default'
  }`;

  return (
    <div className="pointer-events-none w-full h-full rounded-xl border border-border bg-secondary/40 shadow-sm relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelectGroup?.(groupId);
        }}
        className={headerClassName}
        style={{ minHeight: headerHeight }}
      >
        <div className="text-sm leading-snug text-foreground">
          <span className="font-semibold">{name}</span>
          {description && (
            <>
              <span className="text-muted-foreground font-normal"> | </span>
              <span className="text-muted-foreground font-normal">{description}</span>
            </>
          )}
        </div>
      </button>

      {hasNote && (
        <div
          className="absolute left-0 right-0 border-t border-border bg-secondary/70 px-4 py-2 text-xs text-muted-foreground"
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
