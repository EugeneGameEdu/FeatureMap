import { applyGroupFilter } from './groupFilters';
import { applyLayerFilter } from './layerFilters';
import type { FeatureMapData, LayerFilter, ViewMode } from './types';

export interface VisibilityResult {
  visible: boolean;
  message: string;
  nextLayer: LayerFilter;
  nextGroupId: string;
  canReveal: boolean;
}

export function resolveVisibility({
  data,
  viewMode,
  selectedLayer,
  selectedGroupId,
  nodeId,
}: {
  data: FeatureMapData;
  viewMode: ViewMode;
  selectedLayer: LayerFilter;
  selectedGroupId: string;
  nodeId: string;
}): VisibilityResult {
  const visible = isNodeVisible({
    data,
    viewMode,
    selectedLayer,
    selectedGroupId,
    nodeId,
  });
  if (visible) {
    return {
      visible: true,
      message: '',
      nextLayer: selectedLayer,
      nextGroupId: selectedGroupId,
      canReveal: false,
    };
  }

  const visibleWithLayerAll =
    selectedLayer !== 'all' &&
    isNodeVisible({
      data,
      viewMode,
      selectedLayer: 'all',
      selectedGroupId,
      nodeId,
    });
  const visibleWithGroupAll =
    selectedGroupId !== 'all' &&
    isNodeVisible({
      data,
      viewMode,
      selectedLayer,
      selectedGroupId: 'all',
      nodeId,
    });
  const visibleWithAll = isNodeVisible({
    data,
    viewMode,
    selectedLayer: 'all',
    selectedGroupId: 'all',
    nodeId,
  });

  const layerBlocked = selectedLayer !== 'all' && visibleWithLayerAll;
  const groupBlocked = selectedGroupId !== 'all' && visibleWithGroupAll;
  let nextLayer = selectedLayer;
  let nextGroupId = selectedGroupId;

  if (layerBlocked) {
    nextLayer = 'all';
  }
  if (groupBlocked) {
    nextGroupId = 'all';
  }

  if (
    !isNodeVisible({
      data,
      viewMode,
      selectedLayer: nextLayer,
      selectedGroupId: nextGroupId,
      nodeId,
    }) &&
    visibleWithAll
  ) {
    nextLayer = 'all';
    nextGroupId = 'all';
  }

  const parts: string[] = [];
  if (layerBlocked) {
    parts.push(`layer "${selectedLayer}"`);
  }
  if (groupBlocked) {
    const groupName =
      selectedGroupId === 'all'
        ? 'group filter'
        : data.groupsById[selectedGroupId]?.name ?? selectedGroupId;
    parts.push(`group "${groupName}"`);
  }

  const message = parts.length > 0 ? `Hidden by ${parts.join(' and ')}` : 'Hidden by current filters';
  const canReveal = nextLayer !== selectedLayer || nextGroupId !== selectedGroupId;

  return {
    visible: false,
    message,
    nextLayer,
    nextGroupId,
    canReveal,
  };
}

function isNodeVisible({
  data,
  viewMode,
  selectedLayer,
  selectedGroupId,
  nodeId,
}: {
  data: FeatureMapData;
  viewMode: ViewMode;
  selectedLayer: LayerFilter;
  selectedGroupId: string;
  nodeId: string;
}): boolean {
  const graph = viewMode === 'clusters' ? data.clusterGraph : data.featureGraph;
  const layerFiltered = applyLayerFilter(graph.nodes, graph.edges, selectedLayer);
  const groupFiltered = applyGroupFilter(
    layerFiltered.nodes,
    layerFiltered.edges,
    viewMode,
    selectedGroupId,
    data.groupsById,
    data.entities
  );
  return groupFiltered.nodes.some((node) => node.id === nodeId);
}
