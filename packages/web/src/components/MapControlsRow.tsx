import { RefreshCw } from 'lucide-react';
import { ContextViewer } from '@/components/ContextViewer';
import { Button } from '@/components/ui/button';
import { getLayerOrder } from '@/lib/layerFilters';
import type { ContextData } from '@/lib/contextTypes';
import type { GroupSummary, LayerFilter, ViewMode } from '@/lib/types';

const LAYER_FILTERS: Array<{ value: LayerFilter; label: string }> = [
  { value: 'all', label: 'All' },
  ...getLayerOrder().map((layer) => ({
    value: layer,
    label: `${layer[0].toUpperCase()}${layer.slice(1)}`,
  })),
];

interface MapControlsRowProps {
  viewMode: ViewMode;
  selectedLayer: LayerFilter;
  selectedGroupId: string;
  groups: GroupSummary[];
  missingGroupFeatures: string[];
  hasGroups: boolean;
  context: ContextData;
  showComments: boolean;
  layoutMessage: { type: 'error' | 'warning' | 'success'; text: string } | null;
  onPackGroups: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onLayerChange: (layer: LayerFilter) => void;
  onGroupChange: (groupId: string) => void;
  onToggleComments: () => void;
  onRefresh: () => void;
}

export function MapControlsRow({
  viewMode,
  selectedLayer,
  selectedGroupId,
  groups,
  missingGroupFeatures,
  hasGroups,
  context,
  showComments,
  layoutMessage,
  onPackGroups,
  onViewModeChange,
  onLayerChange,
  onGroupChange,
  onToggleComments,
  onRefresh,
}: MapControlsRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-start gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>View:</span>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <Button
              variant={viewMode === 'clusters' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('clusters')}
            >
              Clusters
            </Button>
            <Button
              variant={viewMode === 'features' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('features')}
            >
              Features
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span>Layer:</span>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {LAYER_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={selectedLayer === filter.value ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => onLayerChange(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span>Group:</span>
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            value={selectedGroupId}
            onChange={(event) => onGroupChange(event.target.value)}
            disabled={!hasGroups}
          >
            <option value="all">All groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.featureIds.length})
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={onPackGroups} disabled={!hasGroups}>
            Pack groups
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span>Comments:</span>
          <Button
            variant={showComments ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onToggleComments}
          >
            {showComments ? 'On' : 'Off'}
          </Button>
        </div>
        <ContextViewer context={context} onRefresh={onRefresh} />
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </Button>
      </div>
      {missingGroupFeatures.length > 0 && (
        <div className="text-xs text-[var(--warning)] text-left">
          Missing features in group: {missingGroupFeatures.join(', ')}
        </div>
      )}
      {layoutMessage && (
        <div
          className={`text-xs text-left ${
            layoutMessage.type === 'success'
              ? 'text-[var(--success)]'
              : layoutMessage.type === 'error'
              ? 'text-destructive'
              : 'text-[var(--warning)]'
          }`}
        >
          {layoutMessage.text}
        </div>
      )}
    </div>
  );
}
