import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Pin, PinOff } from 'lucide-react';
import type { CommentNodeData } from '@/lib/commentTypes';

function CommentNodeComponent({ data, selected }: NodeProps) {
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
  } = data as CommentNodeData;
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
      className={`rounded-lg border-2 bg-white shadow-sm px-4 py-3 min-w-[200px] max-w-[260px] ${
        isDraft ? 'border-dashed border-gray-300' : 'border-gray-300'
      } ${selected ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' : ''}`}
      onDoubleClick={() => onStartEdit?.()}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
          COMMENT
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`nodrag nopan ${
              isPinned ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-gray-600'
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
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              Draft
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 rounded-md border border-gray-200 bg-gray-50/80 px-2 py-1">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="w-full min-h-[80px] max-h-[160px] resize-none bg-transparent text-sm text-gray-700 focus:outline-none"
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
              displayContent.trim().length === 0 ? 'text-gray-400 italic' : 'text-gray-700'
            }`}
          >
            {displayContent.trim().length === 0 ? 'Double-click to edit' : displayContent}
          </div>
        )}
      </div>

      {showOrphanWarning && (
        <div className="mt-2 text-[10px] text-amber-600">
          Unlinked note will be deleted unless pinned.
        </div>
      )}

      {saveState === 'error' && saveError && (
        <div className="mt-1 text-[10px] text-red-600">{saveError}</div>
      )}

      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-gray-400" />
    </div>
  );
}

export const CommentNode = memo(CommentNodeComponent);
