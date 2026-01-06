import { MapControlsRow } from '@/components/MapControlsRow';
import { formatDate } from '@/lib/loadFeatureMap';
import type { ContextData } from '@/lib/contextTypes';
import type { GroupSummary, LayerFilter, ViewMode } from '@/lib/types';

interface MapHeaderProps {
  clusterCount: number;
  featureCount: number;
  generatedAt: string;
  viewMode: ViewMode;
  selectedLayer: LayerFilter;
  selectedGroupId: string;
  groups: GroupSummary[];
  missingGroupFeatures: string[];
  hasGroups: boolean;
  context: ContextData;
  showComments: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onLayerChange: (layer: LayerFilter) => void;
  onGroupChange: (groupId: string) => void;
  onToggleComments: () => void;
  onRefresh: () => void;
}

export function MapHeader({
  clusterCount,
  featureCount,
  generatedAt,
  viewMode,
  selectedLayer,
  selectedGroupId,
  groups,
  missingGroupFeatures,
  hasGroups,
  context,
  showComments,
  onViewModeChange,
  onLayerChange,
  onGroupChange,
  onToggleComments,
  onRefresh,
}: MapHeaderProps) {
  return (
    <header className="bg-white border-b px-4 py-3 flex flex-col gap-3 shrink-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">FeatureMap</h1>
          <p className="text-sm text-gray-500">
            {clusterCount} clusters, {featureCount} features - Updated {formatDate(generatedAt)}
          </p>
        </div>
      </div>
      <MapControlsRow
        viewMode={viewMode}
        selectedLayer={selectedLayer}
        selectedGroupId={selectedGroupId}
        groups={groups}
        missingGroupFeatures={missingGroupFeatures}
        hasGroups={hasGroups}
        context={context}
        showComments={showComments}
        onViewModeChange={onViewModeChange}
        onLayerChange={onLayerChange}
        onGroupChange={onGroupChange}
        onToggleComments={onToggleComments}
        onRefresh={onRefresh}
      />
    </header>
  );
}
