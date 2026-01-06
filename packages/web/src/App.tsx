import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import { RefreshCw } from 'lucide-react';
import { FeatureMap } from '@/components/FeatureMap';
import { Sidebar } from '@/components/Sidebar';
import { LeftToolbar } from '@/components/LeftToolbar';
import { MapHeader } from '@/components/MapHeader';
import { SearchPalette } from '@/components/SearchPalette';
import { Button } from '@/components/ui/button';
import { loadComments } from '@/lib/commentLoader';
import { COMMENT_NODE_PREFIX } from '@/lib/commentTypes';
import { applyGroupFilter } from '@/lib/groupFilters';
import { loadFeatureMap } from '@/lib/loadFeatureMap';
import { applyLayerFilter } from '@/lib/layerFilters';
import { useCommentsTool } from '@/lib/useCommentsTool';
import { useSearchNavigation } from '@/lib/useSearchNavigation';
import { connectFeaturemapWs } from '@/lib/wsClient';
import type { FeatureMapData, LayerFilter, ViewMode } from '@/lib/types';

function App() {
  const [data, setData] = useState<FeatureMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('clusters');
  const [selectedLayer, setSelectedLayer] = useState<LayerFilter>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [showComments, setShowComments] = useState(true);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [focusedFilePath, setFocusedFilePath] = useState<string | null>(null);
  const activeGraph = data
    ? viewMode === 'clusters'
      ? data.clusterGraph
      : data.featureGraph
    : null;
  const visibleGraph = useMemo(() => {
    if (!activeGraph || !data) {
      return null;
    }
    const layerFiltered = applyLayerFilter(
      activeGraph.nodes,
      activeGraph.edges,
      selectedLayer
    );
    const groupFiltered = applyGroupFilter(
      layerFiltered.nodes,
      layerFiltered.edges,
      viewMode,
      selectedGroupId,
      data.groupsById,
      data.entities
    );
    return { ...activeGraph, nodes: groupFiltered.nodes, edges: groupFiltered.edges };
  }, [activeGraph, data?.entities, data?.groupsById, selectedGroupId, selectedLayer, viewMode]);
  const visibleNodeIds = useMemo(() => new Set(visibleGraph?.nodes.map((node) => node.id) ?? []), [visibleGraph]);
  const {
    commentElements,
    commentToolMode,
    placementActive,
    handleNodeClick: handleCommentNodeClick,
    handlePaneClick,
    handleConnect,
    handleEdgeRemove,
    handleNodeDragStop,
    handleNodeRemove,
    togglePlacementMode,
  } = useCommentsTool({
    data,
    visibleGraph,
    currentView: viewMode,
    selectedCommentId,
    showComments,
    reactFlowInstance,
  });
  const {
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchWarning,
    focusedNodeId,
    focusedUntil,
    onSearchSelect,
  } = useSearchNavigation({
    data,
    viewMode,
    selectedLayer,
    selectedGroupId,
    reactFlowInstance,
    visibleNodeIds,
    onViewModeChange: setViewMode,
    onSelectedLayerChange: setSelectedLayer,
    onSelectedGroupChange: setSelectedGroupId,
    onSelectedNodeChange: setSelectedNodeId,
    onFocusedFilePathChange: setFocusedFilePath,
  });
  const loadData = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const featureMap = await loadFeatureMap();
      setData(featureMap);
    } catch (err) {
      if (showLoading) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } else {
        console.warn('Failed to refresh data:', err);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);
  const refreshComments = useCallback(async () => {
    try {
      const comments = await loadComments();
      setData((prev) => (prev ? { ...prev, comments } : prev));
    } catch (err) {
      console.warn('Failed to refresh comments:', err);
    }
  }, []);
  useEffect(() => {
    loadData();
  }, [loadData]);
  useEffect(() => {
    const disconnect = connectFeaturemapWs((message) => {
      if (message.type === 'featuremap_changed') {
        if (message.reason === 'comments_updated' || message.file?.startsWith('comments/')) {
          refreshComments();
          return;
        }
        loadData({ showLoading: false });
      }
    });
    return disconnect;
  }, [loadData, refreshComments]);
  useEffect(() => {
    if (!selectedNodeId || !visibleGraph) {
      return;
    }
    const exists = visibleGraph.nodes.some((node) => node.id === selectedNodeId);
    if (!exists) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, visibleGraph]);
  useEffect(() => {
    if (!selectedCommentId) {
      return;
    }
    const commentNodeId = `${COMMENT_NODE_PREFIX}${selectedCommentId}`;
    const exists = commentElements.nodes.some((node) => node.id === commentNodeId);
    if (!exists) {
      setSelectedCommentId(null);
    }
  }, [commentElements.nodes, selectedCommentId]);
  useEffect(() => {
    if (!data) {
      return;
    }
    if (selectedGroupId !== 'all' && !data.groupsById[selectedGroupId]) {
      setSelectedGroupId('all');
    }
  }, [data, selectedGroupId]);
  const handleNodeClick = (nodeId: string) => {
    if (handleCommentNodeClick(nodeId)) {
      setFocusedFilePath(null); setSelectedNodeId(null);
      setSelectedCommentId(nodeId.slice(COMMENT_NODE_PREFIX.length));
      return;
    }
    setFocusedFilePath(null); setSelectedCommentId(null);
    setSelectedNodeId(nodeId);
  };
  const handleDependencyClick = (nodeId: string) => {
    if (!data?.entities[nodeId]) {
      return;
    }
    const graph = viewMode === 'clusters' ? data.clusterGraph : data.featureGraph;
    const exists = graph.nodes.some((node) => node.id === nodeId);
    if (!exists && viewMode === 'features') {
      setViewMode('clusters');
    }
    setFocusedFilePath(null); setSelectedCommentId(null);
    setSelectedNodeId(nodeId);
  };
  const handleCloseSidebar = () => {
    setFocusedFilePath(null);
    setSelectedNodeId(null);
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="animate-spin" size={20} />
          <span>Loading feature map...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-red-600 font-bold mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadData}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!data || !activeGraph || !visibleGraph) return null;

  const selectedNode = selectedNodeId ? data.entities[selectedNodeId] : null;
  const clusterCount = data.clusterGraph.nodes.length;
  const featureCount = data.featureGraph.nodes.length;
  const fileCount = Object.values(data.entities).reduce(
    (sum, entity) => (entity.kind === 'cluster' ? sum + entity.data.files.length : sum),
    0
  );
  const selectedGroup = selectedGroupId === 'all' ? null : data.groupsById[selectedGroupId];
  const missingGroupFeatures = selectedGroup?.missingFeatureIds ?? [];
  const hasGroups = data.groups.length > 0;
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <SearchPalette
        open={searchOpen}
        query={searchQuery}
        results={searchResults}
        warning={searchWarning}
        onOpenChange={setSearchOpen}
        onQueryChange={setSearchQuery}
        onSelectResult={onSearchSelect}
      />
        <MapHeader
          clusterCount={clusterCount}
          featureCount={featureCount}
          fileCount={fileCount}
          generatedAt={data.graph.generatedAt}
        viewMode={viewMode}
        selectedLayer={selectedLayer}
        selectedGroupId={selectedGroupId}
        groups={data.groups}
        missingGroupFeatures={missingGroupFeatures}
        hasGroups={hasGroups}
        context={data.context}
        showComments={showComments}
        onViewModeChange={setViewMode}
        onLayerChange={setSelectedLayer}
        onGroupChange={setSelectedGroupId}
        onToggleComments={() => setShowComments((current) => !current)}
        onRefresh={loadData}
      />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative">
          <LeftToolbar
            onSearchClick={() => setSearchOpen(true)}
            commentMode={commentToolMode}
            onToggleAddMode={togglePlacementMode}
          />
          <FeatureMap
            graph={visibleGraph}
            entities={data.entities}
            commentNodes={commentElements.nodes}
            commentEdges={commentElements.edges}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onConnect={handleConnect}
            onEdgeRemove={handleEdgeRemove}
            onNodeDragStop={handleNodeDragStop}
            onNodeRemove={handleNodeRemove}
            commentPlacementActive={placementActive}
            onInit={setReactFlowInstance}
            selectedNodeId={selectedNodeId}
            focusedNodeId={focusedNodeId}
            focusedUntil={focusedUntil}
          />
        </main>

        <Sidebar
          node={selectedNode}
          onClose={handleCloseSidebar}
          onDependencyClick={handleDependencyClick}
          groups={data.groups}
          focusedFilePath={focusedFilePath}
        />
      </div>
    </div>
  );
}

export default App;
