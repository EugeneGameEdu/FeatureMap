import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Pin, PinOff } from 'lucide-react';
import type { CommentNodeData } from '@/lib/commentTypes';

export type CommentFlowNode = Node<CommentNodeData, 'comment'>;

function CommentNodeComponent({ data, selected }: NodeProps<CommentFlowNode>) {
  const {
    content,
    isDraft,
    isEditing,
    isPinned,
    showOrphanWarning,
    saveState,
    saveError,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onTogglePin,
  } = data;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const skipCommitRef = useRef(false);
  const [draftValue, setDraftValue] = useState(content);

  const displayContent = isEditing ? draftValue : content;

  useEffect(() => {
    if (isEditing) {
      setDraftValue(content);
    }
  }, [content, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      skipCommitRef.current = true;
      setDraftValue(content);
      onCancelEdit?.();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      onCommitEdit?.(draftValue);
    }
  };

  return (
    <div
      className={`rounded-lg border-2 bg-card shadow-sm px-4 py-3 min-w-[200px] max-w-[260px] ${
        isDraft ? 'border-dashed border-border' : 'border-border'
      } ${selected ? 'border-primary ring-2 ring-primary/30 shadow-md' : ''}`}
      onDoubleClick={() => onStartEdit?.()}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          COMMENT
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`nodrag nopan ${
              isPinned ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground'
            }`}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin?.();
            }}
            title="Pinned keeps this note even if it has no links. Unlinked notes are not sent to AI."
            aria-label={isPinned ? 'Unpin comment' : 'Pin comment'}
          >
            {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
          {isDraft && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
              Draft
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 rounded-md border border-border bg-muted/70 px-2 py-1">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="w-full min-h-[80px] max-h-[160px] resize-none bg-transparent text-sm text-foreground focus:outline-none"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={() => {
              if (skipCommitRef.current) {
                skipCommitRef.current = false;
                return;
              }
              onCommitEdit?.(draftValue);
            }}
            onKeyDown={handleKeyDown}
            onMouseDown={(event) => event.stopPropagation()}
          />
        ) : (
          <div
            className={`text-sm whitespace-pre-wrap ${
              displayContent.trim().length === 0 ? 'text-muted-foreground italic' : 'text-foreground'
            }`}
          >
            {displayContent.trim().length === 0 ? 'Double-click to edit' : displayContent}
          </div>
        )}
      </div>

      {showOrphanWarning && (
        <div className="mt-2 text-[10px] text-[var(--warning)]">
          Unlinked note will be deleted unless pinned.
        </div>
      )}

      {saveState === 'error' && saveError && (
        <div className="mt-1 text-[10px] text-destructive">{saveError}</div>
      )}

      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-muted-foreground" />
    </div>
  );
}

export const CommentNode = memo(CommentNodeComponent);
