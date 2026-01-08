import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Box, Folder, Layers } from 'lucide-react';
import type { Layer } from '@/lib/types';

export interface FeatureNodeData extends Record<string, unknown> {
  label: string;
  kind: 'cluster' | 'feature';
  fileCount: number;
  source: 'auto' | 'ai' | 'user';
  status: 'active' | 'deprecated' | 'ignored';
  dependencyCount: number;
  layer?: Layer;
  layers?: Layer[];
  isFocused?: boolean;
}

export type FeatureFlowNode = Node<FeatureNodeData, 'feature' | 'cluster'>;

function FeatureNodeComponent({ data, selected }: NodeProps<FeatureFlowNode>) {
  const { label, kind, fileCount, source, status, dependencyCount, isFocused } = data;

  const Icon = fileCount > 5 ? Layers : fileCount > 1 ? Folder : Box;

  const borderColor = selected
    ? 'border-blue-500'
    : source === 'ai'
    ? 'border-green-400'
    : source === 'user'
    ? 'border-purple-400'
    : 'border-gray-300';

  const bgColor =
    status === 'deprecated'
      ? 'bg-amber-50'
      : status === 'ignored'
      ? 'bg-gray-100'
      : 'bg-white';

  const focusRing = isFocused
    ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-white animate-pulse'
    : '';

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-sm min-w-[160px]
        transition-all duration-150
        ${borderColor} ${bgColor}
        ${selected ? 'shadow-md ring-2 ring-blue-200' : 'hover:shadow-md'}
        ${focusRing}
      `}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-gray-400" />

      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Icon
            size={18}
            className={
              source === 'ai'
                ? 'text-green-500'
                : source === 'user'
                ? 'text-purple-500'
                : 'text-gray-400'
            }
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-800 truncate">{label}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">
              {fileCount} {fileCount === 1 ? 'file' : 'files'}
            </span>
            {dependencyCount > 0 && (
              <span className="text-xs text-gray-400">
                {'-> '}
                {dependencyCount}
              </span>
            )}
            <span className="text-[10px] uppercase text-gray-400">{kind}</span>
          </div>
        </div>

        {source !== 'auto' && (
          <div
            className={`
              text-[10px] px-1.5 py-0.5 rounded font-medium
              ${source === 'ai' ? 'bg-green-100 text-green-700' : ''}
              ${source === 'user' ? 'bg-purple-100 text-purple-700' : ''}
            `}
          >
            {source === 'ai' ? 'AI' : 'User'}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-400" />
    </div>
  );
}

export const FeatureNode = memo(FeatureNodeComponent);
