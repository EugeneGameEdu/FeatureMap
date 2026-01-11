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
    ? 'border-primary'
    : source === 'ai'
    ? 'border-emerald-400'
    : source === 'user'
    ? 'border-purple-400'
    : 'border-border';

  const bgColor =
    status === 'deprecated'
      ? 'bg-muted'
    : status === 'ignored'
      ? 'bg-secondary/60'
      : 'bg-card';

  const focusRing = isFocused
    ? 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background animate-pulse'
    : '';

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-sm min-w-[160px]
        transition-all duration-150
        ${borderColor} ${bgColor}
        ${selected ? 'shadow-md ring-2 ring-primary/30' : 'hover:shadow-md'}
        ${focusRing}
      `}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-muted-foreground" />

      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Icon
            size={18}
            className={
              source === 'ai'
                ? 'text-emerald-400'
                : source === 'user'
                ? 'text-purple-400'
                : 'text-muted-foreground'
            }
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground truncate">{label}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {fileCount} {fileCount === 1 ? 'file' : 'files'}
            </span>
            {dependencyCount > 0 && (
              <span className="text-xs text-muted-foreground/80">
                {'-> '}
                {dependencyCount}
              </span>
            )}
            <span className="text-[10px] uppercase text-muted-foreground/80">{kind}</span>
          </div>
        </div>

        {source !== 'auto' && (
          <div
            className={`
              text-[10px] px-1.5 py-0.5 rounded font-medium
              ${source === 'ai' ? 'bg-emerald-500/20 text-emerald-200' : ''}
              ${source === 'user' ? 'bg-purple-500/20 text-purple-200' : ''}
            `}
          >
            {source === 'ai' ? 'AI' : 'User'}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-muted-foreground" />
    </div>
  );
}

export const FeatureNode = memo(FeatureNodeComponent);
