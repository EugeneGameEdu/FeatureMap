import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import { FeatureMap } from '@/components/FeatureMap';
import { Sidebar } from '@/components/Sidebar';
import { LeftToolbar } from '@/components/LeftToolbar';
import { MapHeader } from '@/components/MapHeader';
import { SearchPalette } from '@/components/SearchPalette';
import { ErrorScreen, LoadingScreen } from '@/components/StatusScreens';
import { COMMENT_NODE_PREFIX } from '@/lib/commentTypes';
import { applyGroupFilter } from '@/lib/groupFilters';
import { buildPrimaryGroupMembership } from '@/lib/groupMembership';
import { applyLayerFilter } from '@/lib/layerFilters';
import { useCommentsTool } from '@/lib/useCommentsTool';
import { useFeatureMapData } from '@/lib/useFeatureMapData';
import { useGroupLayoutActions } from '@/lib/useGroupLayoutActions';
import { useGroupSelection } from '@/lib/useGroupSelection';
import { useSearchNavigation } from '@/lib/useSearchNavigation';
import type { LayerFilter, ViewMode } from '@/lib/types';
function App() {
  const { data, loading, error, loadData, updateLayoutPositions, updateGroupNote } =
    useFeatureMapData();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('clusters');
  const [selectedLayer, setSelectedLayer] = useState<LayerFilter>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [showComments, setShowComments] = useState(true);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [focusedFilePath, setFocusedFilePath] = useState<string | null>(null);
  const activeGraph = data ? (viewMode === 'clusters' ? data.clusterGraph : data.featureGraph) : null;
  const layoutPositions = data?.layout?.positions ?? {};
  const primaryGroupMembership = useMemo(() => {
    if (!data) {
      return { membership: new Map<string, string[]>(), multiGroupNodeIds: [] };
    }
    return buildPrimaryGroupMembership(data.groups, data.entities, viewMode);
  }, [data, viewMode]);
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
      data.entities,
      primaryGroupMembership.membership
    );
    return { ...activeGraph, nodes: groupFiltered.nodes, edges: groupFiltered.edges };
  }, [
    activeGraph,
    data?.entities,
    data?.groupsById,
    primaryGroupMembership.membership,
    selectedGroupId,
    selectedLayer,
    viewMode,
  ]);
  const visibleNodeIds = useMemo(() => new Set(visibleGraph?.nodes.map((node) => node.id) ?? []), [visibleGraph]);
  const {
    clearGroupSelection,
    selectGroup,
    selectedGroupDetails,
    selectedGroupDetailsId,
    selectedGroupMembers,
    groupMembership,
    multiGroupNodeIds,
  } = useGroupSelection({
    data,
    viewMode,
    selectedGroupId,
    visibleNodeIds,
    groupMembership: primaryGroupMembership.membership,
    multiGroupNodeIds: primaryGroupMembership.multiGroupNodeIds,
  });
  const { layoutMessage, packGroups, handleGroupDragStop } = useGroupLayoutActions({
    reactFlowInstance,
    groups: data?.groups ?? [],
    groupMembership,
    selectedGroupId,
    multiGroupNodeIds,
    onLayoutPositionsChange: updateLayoutPositions,
  });
  const handleSelectedNodeChange = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (nodeId) {
      clearGroupSelection();
      setSelectedCommentId(null);
    }
  }, [clearGroupSelection]);
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
    onSelectedNodeChange: handleSelectedNodeChange,
    onFocusedFilePathChange: setFocusedFilePath,
  });
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
      clearGroupSelection();
      setSelectedCommentId(nodeId.slice(COMMENT_NODE_PREFIX.length));
      return;
    }
    setFocusedFilePath(null); setSelectedCommentId(null);
    clearGroupSelection();
    setSelectedNodeId(nodeId);
  };
  const handleGroupSelect = (groupId: string) => {
    setFocusedFilePath(null);
    setSelectedCommentId(null);
    setSelectedNodeId(null);
    selectGroup(groupId);
  };
  const handleGroupUpdated = useCallback(
    (groupId: string, note: string | null) => {
      updateGroupNote(groupId, note);
    },
    [updateGroupNote]
  );
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
    clearGroupSelection();
    setSelectedNodeId(nodeId);
  };
  const handleCloseSidebar = () => {
    setFocusedFilePath(null);
    setSelectedNodeId(null);
    clearGroupSelection();
  };
  if (loading) {
    return <LoadingScreen />;
  }
  if (error) {
    return <ErrorScreen message={error} onRetry={loadData} />;
  }
  if (!data || !activeGraph || !visibleGraph) return null;
  const selectedNode = selectedGroupDetailsId ? null : selectedNodeId ? data.entities[selectedNodeId] : null;
  const clusterCount = data.clusterGraph.nodes.length;
  const featureCount = data.featureGraph.nodes.length;
  const fileCount = Object.values(data.entities).reduce(
    (sum, entity) => (entity.kind === 'cluster' ? sum + entity.data.files.length : sum),
    0
  );
  const connectionCount = data.graph.edges.length;
  const projectStats = {
    clusters: clusterCount,
    features: featureCount,
    files: fileCount,
    connections: connectionCount,
    updatedAt: data.graph.generatedAt,
  };
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
        viewMode={viewMode}
        selectedLayer={selectedLayer}
        selectedGroupId={selectedGroupId}
        groups={data.groups}
        missingGroupFeatures={missingGroupFeatures}
        hasGroups={hasGroups}
        context={data.context}
        showComments={showComments}
        layoutMessage={layoutMessage}
        onPackGroups={packGroups}
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
            layoutPositions={layoutPositions}
            groups={data.groups}
            groupMembership={groupMembership}
            selectedGroupId={selectedGroupId}
            selectedGroupDetailsId={selectedGroupDetailsId}
            onGroupSelect={handleGroupSelect}
            commentNodes={commentElements.nodes}
            commentEdges={commentElements.edges}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onConnect={handleConnect}
            onEdgeRemove={handleEdgeRemove}
            onNodeDragStop={handleNodeDragStop}
            onNodeRemove={handleNodeRemove}
            onGroupDragStop={handleGroupDragStop}
            commentPlacementActive={placementActive}
            onInit={setReactFlowInstance}
            selectedNodeId={selectedNodeId}
            focusedNodeId={focusedNodeId}
            focusedUntil={focusedUntil}
          />
        </main>
        <Sidebar
          node={selectedNode}
          group={selectedGroupDetails}
          groupMembers={selectedGroupMembers}
          viewMode={viewMode}
          onClose={handleCloseSidebar}
          onGroupUpdated={handleGroupUpdated}
          onDependencyClick={handleDependencyClick}
          groups={data.groups}
          focusedFilePath={focusedFilePath}
          stats={projectStats}
          techStack={data.context.techStack}
          conventions={data.context.conventions}
        />
      </div>
    </div>
  );
}

export default App;
