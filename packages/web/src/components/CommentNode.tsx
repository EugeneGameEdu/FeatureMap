import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CommentNodeData } from '@/lib/commentTypes';

const priorityStyles: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

function CommentNodeComponent({ data }: NodeProps) {
  const { content, tags, priority } = data as CommentNodeData;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 shadow-sm px-3 py-2 min-w-[200px] max-w-[260px]">
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-amber-400" />
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-amber-600">Comment</span>
        {priority && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityStyles[priority]}`}>
            {priority}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap max-h-32 overflow-hidden">
        {content}
      </div>
      {tags && tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-white text-amber-700 border border-amber-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-amber-400" />
    </div>
  );
}

export const CommentNode = memo(CommentNodeComponent);
