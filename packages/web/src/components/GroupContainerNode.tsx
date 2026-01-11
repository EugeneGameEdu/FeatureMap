import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { GroupContainerNode as GroupContainerFlowNode } from '@/lib/groupContainers';

function GroupContainerNodeComponent({ data }: NodeProps<GroupContainerFlowNode>) {
  const {
    groupId,
    name,
    description,
    note,
    headerHeight,
    noteHeight,
    isSelected,
    isCollapsed,
    onSelectGroup,
    onToggleCollapsed,
  } = data;
  const hasNote = Boolean(note);

  const headerClassName = `group-container__header pointer-events-auto flex w-full items-start gap-2 px-4 py-2 border-b border-border bg-card/80 rounded-t-xl whitespace-normal break-words ${
    isSelected ? 'ring-1 ring-primary/60 cursor-grab active:cursor-grabbing' : 'cursor-default'
  }`;

  return (
    <div className="pointer-events-none w-full h-full rounded-xl border border-border bg-secondary/40 shadow-sm relative">
      <div
        className={headerClassName}
        style={{ minHeight: headerHeight }}
        onClick={(event) => {
          event.stopPropagation();
          onSelectGroup?.(groupId);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectGroup?.(groupId);
          }
        }}
      >
        <div className="flex-1 text-sm leading-snug text-foreground">
          <span className="font-semibold">{name}</span>
          {description && (
            <>
              <span className="text-muted-foreground font-normal"> | </span>
              <span className="text-muted-foreground font-normal">{description}</span>
            </>
          )}
        </div>
        <button
          type="button"
          className="pointer-events-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-secondary/70"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapsed?.(groupId);
          }}
          aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

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
