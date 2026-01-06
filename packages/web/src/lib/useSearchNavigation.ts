import { useEffect, useMemo, useState } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import { buildFocusState, focusNode } from './focusHelpers';
import { buildSearchIndex, type SearchIndexEntry } from './searchIndex';
import { rankSearchResults } from './searchScoring';
import { resolveVisibility } from './searchVisibility';
import type { FeatureMapData, LayerFilter, ViewMode } from './types';

interface PendingFocus {
  nodeId: string;
}

interface BlockedResult {
  entry: SearchIndexEntry;
  message: string;
  nextLayer: LayerFilter;
  nextGroupId: string;
  canReveal: boolean;
}

export interface SearchWarning {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface UseSearchNavigationOptions {
  data: FeatureMapData | null;
  viewMode: ViewMode;
  selectedLayer: LayerFilter;
  selectedGroupId: string;
  reactFlowInstance: ReactFlowInstance | null;
  visibleNodeIds: Set<string>;
  onViewModeChange: (mode: ViewMode) => void;
  onSelectedLayerChange: (layer: LayerFilter) => void;
  onSelectedGroupChange: (groupId: string) => void;
  onSelectedNodeChange: (nodeId: string | null) => void;
  onFocusedFilePathChange: (path: string | null) => void;
}

export function useSearchNavigation({
  data,
  viewMode,
  selectedLayer,
  selectedGroupId,
  reactFlowInstance,
  visibleNodeIds,
  onViewModeChange,
  onSelectedLayerChange,
  onSelectedGroupChange,
  onSelectedNodeChange,
  onFocusedFilePathChange,
}: UseSearchNavigationOptions) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null);
  const [blockedResult, setBlockedResult] = useState<BlockedResult | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [focusedUntil, setFocusedUntil] = useState<number | null>(null);

  const searchIndex = useMemo(() => (data ? buildSearchIndex(data) : []), [data]);
  const searchResults = useMemo(
    () => rankSearchResults(searchIndex, searchQuery),
    [searchIndex, searchQuery]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if (shouldIgnoreShortcut(event)) {
          return;
        }
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!focusedUntil || !focusedNodeId) {
      return;
    }
    const remaining = focusedUntil - Date.now();
    if (remaining <= 0) {
      setFocusedNodeId(null);
      setFocusedUntil(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      setFocusedNodeId(null);
      setFocusedUntil(null);
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [focusedNodeId, focusedUntil]);

  useEffect(() => {
    if (!pendingFocus || !reactFlowInstance) {
      return;
    }
    if (!visibleNodeIds.has(pendingFocus.nodeId)) {
      return;
    }
    if (focusNode(reactFlowInstance, pendingFocus.nodeId)) {
      const focusState = buildFocusState(pendingFocus.nodeId);
      setFocusedNodeId(focusState.focusedNodeId);
      setFocusedUntil(focusState.focusedUntil);
    }
    setPendingFocus(null);
  }, [pendingFocus, reactFlowInstance, visibleNodeIds]);

  useEffect(() => {
    setBlockedResult(null);
  }, [searchQuery, selectedLayer, selectedGroupId, viewMode]);

  const handleSearchSelect = (entry: SearchIndexEntry) => {
    if (!data) {
      return;
    }
    const targetViewMode = entry.type === 'feature' ? 'features' : 'clusters';
    const targetNodeId = entry.type === 'file' ? entry.metadata.clusterId : entry.id;
    if (!targetNodeId) {
      return;
    }
    onViewModeChange(targetViewMode);

    const visibility = resolveVisibility({
      data,
      viewMode: targetViewMode,
      selectedLayer,
      selectedGroupId,
      nodeId: targetNodeId,
    });

    if (!visibility.visible) {
      setBlockedResult({
        entry,
        message: visibility.message,
        nextLayer: visibility.nextLayer,
        nextGroupId: visibility.nextGroupId,
        canReveal: visibility.canReveal,
      });
      return;
    }

    setBlockedResult(null);
    onSelectedNodeChange(targetNodeId);
    onFocusedFilePathChange(entry.type === 'file' ? entry.metadata.filePath ?? null : null);
    setPendingFocus({ nodeId: targetNodeId });
    setSearchOpen(false);
  };

  const handleRevealFilters = () => {
    if (!blockedResult || !data) {
      return;
    }
    const entry = blockedResult.entry;
    const targetViewMode = entry.type === 'feature' ? 'features' : 'clusters';
    const targetNodeId = entry.type === 'file' ? entry.metadata.clusterId : entry.id;
    if (!targetNodeId) {
      return;
    }
    onViewModeChange(targetViewMode);
    if (blockedResult.nextLayer !== selectedLayer) {
      onSelectedLayerChange(blockedResult.nextLayer);
    }
    if (blockedResult.nextGroupId !== selectedGroupId) {
      onSelectedGroupChange(blockedResult.nextGroupId);
    }
    onSelectedNodeChange(targetNodeId);
    onFocusedFilePathChange(entry.type === 'file' ? entry.metadata.filePath ?? null : null);
    setPendingFocus({ nodeId: targetNodeId });
    setBlockedResult(null);
    setSearchOpen(false);
  };

  const searchWarning: SearchWarning | null = blockedResult
    ? {
        message: blockedResult.message,
        actionLabel: blockedResult.canReveal ? 'Show it' : undefined,
        onAction: blockedResult.canReveal ? handleRevealFilters : undefined,
      }
    : null;

  return {
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchWarning,
    focusedNodeId,
    focusedUntil,
    onSearchSelect: handleSearchSelect,
  };
}

function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return false;
  }
  const tagName = target.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.isContentEditable
  );
}
