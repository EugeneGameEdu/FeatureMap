import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react';
import { FeatureMap } from '@/components/FeatureMap';
import { Sidebar } from '@/components/Sidebar';
import { LeftToolbar } from '@/components/LeftToolbar';
import { MapHeader } from '@/components/MapHeader';
import { SearchPalette } from '@/components/SearchPalette';
import { ErrorScreen, LoadingScreen } from '@/components/StatusScreens';
import { COMMENT_EDGE_TYPE, COMMENT_NODE_PREFIX, isCommentNodeId } from '@/lib/commentTypes';
import { EdgeDetailsPanel } from '@/components/EdgeDetailsPanel';
import { applyGroupFilter } from '@/lib/groupFilters';
import { buildGroupMembership, buildPrimaryGroupMembership } from '@/lib/groupMembership';
import { applyLayerFilter } from '@/lib/layerFilters';
import { getLayoutedPositions } from '@/lib/graphLayout';
import { useCommentsTool } from '@/lib/useCommentsTool';
import { useFeatureMapData } from '@/lib/useFeatureMapData';
import { useGroupLayoutActions } from '@/lib/useGroupLayoutActions';
import { useGroupSelection } from '@/lib/useGroupSelection';
import { useSearchNavigation } from '@/lib/useSearchNavigation';
import type { EdgeStyle, LayerFilter, ViewMode } from '@/lib/types';
import { buildEdgeId } from '@/lib/featureMapElements';
function App() {
  const { data, loading, error, loadData, updateLayoutPositions, updateGroupNote } =
    useFeatureMapData();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('clusters');
  const [selectedLayer, setSelectedLayer] = useState<LayerFilter>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [showComments, setShowComments] = useState(true);
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>('bezier');
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [readOnly, setReadOnly] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [focusedFilePath, setFocusedFilePath] = useState<string | null>(null);
  const activeGraph = data ? (viewMode === 'clusters' ? data.clusterGraph : data.featureGraph) : null;
  const layoutPositions = data?.layout?.positions ?? {};
  const primaryGroupMembership = useMemo(() => (data ? buildPrimaryGroupMembership(data.groups, data.entities, viewMode) : { membership: new Map<string, string[]>(), multiGroupNodeIds: [] }), [data, viewMode]);
  const fullGroupMembership = useMemo(() => (data ? buildGroupMembership(data.groups, data.entities, viewMode) : new Map<string, string[]>()), [data, viewMode]);
  const hiddenNodeIds = useMemo(() => {
    if (!data || collapsedGroupIds.size === 0) {
      return new Set<string>();
    }
    const hidden = new Set<string>();
    for (const groupId of collapsedGroupIds) {
      const members = fullGroupMembership.get(groupId) ?? [];
      members.forEach((memberId) => hidden.add(memberId));
    }
    return hidden;
  }, [collapsedGroupIds, data, fullGroupMembership]);
  const visibleGraph = useMemo(() => {
    if (!activeGraph || !data) return null;
    const layerFiltered = applyLayerFilter(activeGraph.nodes, activeGraph.edges, selectedLayer);
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
  }, [activeGraph, data?.entities, data?.groupsById, primaryGroupMembership.membership, selectedGroupId, selectedLayer, viewMode]);
  const visibleNodeIds = useMemo(() => {
    if (!visibleGraph) return new Set<string>();
    return new Set(visibleGraph.nodes.filter((node) => !hiddenNodeIds.has(node.id)).map((node) => node.id));
  }, [hiddenNodeIds, visibleGraph]);
  const { clearGroupSelection, selectGroup, selectedGroupDetails, selectedGroupDetailsId, selectedGroupMembers, groupMembership, multiGroupNodeIds } = useGroupSelection({ data, viewMode, selectedGroupId, visibleNodeIds, groupMembership: primaryGroupMembership.membership, multiGroupNodeIds: primaryGroupMembership.multiGroupNodeIds });
  const { layoutMessage, packGroups, handleGroupDragStop, saveLayoutPositions } = useGroupLayoutActions({
    reactFlowInstance, groups: data?.groups ?? [], groupMembership, selectedGroupId, multiGroupNodeIds, onLayoutPositionsChange: updateLayoutPositions,
  });
  const handleAutoLayout = useCallback(async () => {
    if (!reactFlowInstance) return;
    const graphNodes = reactFlowInstance.getNodes().filter((node) => node.type === 'feature' || node.type === 'cluster');
    if (graphNodes.length === 0) {
      await saveLayoutPositions({}, { emptyText: 'No visible nodes to layout.' });
      return;
    }
    const graphNodeIds = new Set(graphNodes.map((node) => node.id));
    const graphEdges = reactFlowInstance.getEdges().filter((edge) => graphNodeIds.has(edge.source) && graphNodeIds.has(edge.target));
    const positions = getLayoutedPositions(graphNodes, graphEdges, 'TB');
    await saveLayoutPositions(positions, { allowUnsaved: true, successText: 'Auto layout saved.' });
  }, [reactFlowInstance, saveLayoutPositions]);
  const handleSelectedNodeChange = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (!nodeId) return;
    setSelectedEdgeId(null);
    clearGroupSelection();
    setSelectedCommentId(null);
  }, [clearGroupSelection]);
  const { commentElements, commentToolMode, placementActive, handleNodeClick: handleCommentNodeClick, handlePaneClick, handleConnect, handleEdgeRemove, handleNodeDragStop: handleCommentNodeDragStop, handleNodeRemove, togglePlacementMode } = useCommentsTool({
    data, visibleGraph, currentView: viewMode, selectedCommentId, showComments, reactFlowInstance, readOnly,
  });
  const handleNodeDragStop = useCallback((node: Node) => {
    if (isCommentNodeId(node.id)) {
      handleCommentNodeDragStop(node);
      return;
    }
    void saveLayoutPositions({ [node.id]: node.position }, { allowUnsaved: true });
  }, [handleCommentNodeDragStop, saveLayoutPositions]);
  const { searchOpen, setSearchOpen, searchQuery, setSearchQuery, searchResults, searchWarning, focusedNodeId, focusedUntil, onSearchSelect } = useSearchNavigation({
    data, viewMode, selectedLayer, selectedGroupId, reactFlowInstance, visibleNodeIds,
    onViewModeChange: setViewMode, onSelectedLayerChange: setSelectedLayer,
    onSelectedGroupChange: setSelectedGroupId, onSelectedNodeChange: handleSelectedNodeChange,
    onFocusedFilePathChange: setFocusedFilePath,
  });
  const connectedEdgeIds = useMemo(() => {
    if (!selectedNodeId || !visibleGraph) return new Set<string>();
    const connected = new Set<string>();
    visibleGraph.edges.forEach((edge, index) => {
      if (hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target)) {
        return;
      }
      if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
        connected.add(buildEdgeId(edge, index));
      }
    });
    return connected;
  }, [hiddenNodeIds, selectedNodeId, visibleGraph]);
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId || !visibleGraph) return new Set<string>();
    const connected = new Set<string>();
    visibleGraph.edges.forEach((edge) => {
      if (hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target)) {
        return;
      }
      if (edge.source === selectedNodeId) {
        connected.add(edge.target);
      } else if (edge.target === selectedNodeId) {
        connected.add(edge.source);
      }
    });
    return connected;
  }, [hiddenNodeIds, selectedNodeId, visibleGraph]);
  const selectedNodeDependencies = useMemo(() => {
    if (!selectedNodeId || !visibleGraph) return [];
    return visibleGraph.edges
      .filter((edge) => edge.source === selectedNodeId)
      .map((edge) => edge.target);
  }, [selectedNodeId, visibleGraph]);
  const selectedEdge = useMemo(() => {
    if (!selectedEdgeId || !visibleGraph) return null;
    return (
      visibleGraph.edges.find((edge, index) => buildEdgeId(edge, index) === selectedEdgeId) ?? null
    );
  }, [selectedEdgeId, visibleGraph]);
  const selectedEdgeStorageId = selectedEdgeId ?? (selectedEdge ? String(selectedEdge.id) : '');
  const selectedEdgeSourceLabel = useMemo(() => {
    if (!selectedEdge || !data) return '';
    return data.entities[selectedEdge.source]?.label ?? selectedEdge.source;
  }, [data, selectedEdge]);
  const selectedEdgeTargetLabel = useMemo(() => {
    if (!selectedEdge || !data) return '';
    return data.entities[selectedEdge.target]?.label ?? selectedEdge.target;
  }, [data, selectedEdge]);
  useEffect(() => {
    if (!selectedNodeId || !visibleGraph) return;
    const exists = visibleGraph.nodes.some((node) => node.id === selectedNodeId);
    if (!exists) setSelectedNodeId(null);
  }, [selectedNodeId, visibleGraph]);
  useEffect(() => {
    if (!selectedNodeId) return;
    if (hiddenNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [hiddenNodeIds, selectedNodeId]);
  useEffect(() => {
    if (!selectedCommentId) return;
    const commentNodeId = `${COMMENT_NODE_PREFIX}${selectedCommentId}`;
    const exists = commentElements.nodes.some((node) => node.id === commentNodeId);
    if (!exists) setSelectedCommentId(null);
  }, [commentElements.nodes, selectedCommentId]);
  useEffect(() => {
    if (!selectedEdgeId || !visibleGraph) return;
    const exists = visibleGraph.edges.some((edge, index) => buildEdgeId(edge, index) === selectedEdgeId);
    if (!exists) setSelectedEdgeId(null);
  }, [selectedEdgeId, visibleGraph]);
  useEffect(() => {
    if (!data) return;
    if (selectedGroupId !== 'all' && !data.groupsById[selectedGroupId]) setSelectedGroupId('all');
  }, [data, selectedGroupId]);
  const handleNodeClick = (nodeId: string) => {
    if (handleCommentNodeClick(nodeId)) {
      setFocusedFilePath(null); setSelectedNodeId(null); setSelectedEdgeId(null); clearGroupSelection();
      setSelectedCommentId(nodeId.slice(COMMENT_NODE_PREFIX.length));
      return;
    }
    setFocusedFilePath(null); setSelectedCommentId(null); setSelectedEdgeId(null); clearGroupSelection(); setSelectedNodeId(nodeId);
  };
  const handleEdgeClick = useCallback((event: MouseEvent, edge: Edge) => {
    if (edge.type === COMMENT_EDGE_TYPE || edge.id.startsWith('comment-link:')) return;
    event.stopPropagation();
    setSelectedEdgeId(edge.id); setSelectedNodeId(null); clearGroupSelection(); setSelectedCommentId(null);
  }, [clearGroupSelection]);
  const handleGroupSelect = (groupId: string) => {
    setFocusedFilePath(null); setSelectedCommentId(null); setSelectedNodeId(null); setSelectedEdgeId(null); selectGroup(groupId);
  };
  const handleGroupCollapseToggle = useCallback((groupId: string) => {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);
  const handleGroupUpdated = useCallback(
    (groupId: string, note: string | null) => updateGroupNote(groupId, note),
    [updateGroupNote]
  );
  const handleDependencyClick = (nodeId: string) => {
    if (!data?.entities[nodeId]) return;
    const graph = viewMode === 'clusters' ? data.clusterGraph : data.featureGraph;
    if (!graph.nodes.some((node) => node.id === nodeId) && viewMode === 'features') {
      setViewMode('clusters');
    }
    setFocusedFilePath(null); setSelectedCommentId(null); setSelectedEdgeId(null); clearGroupSelection(); setSelectedNodeId(nodeId);
  };
  const handleViewEdgeSource = useCallback(() => {
    if (!selectedEdge) return;
    handleDependencyClick(selectedEdge.source);
  }, [handleDependencyClick, selectedEdge]);
  const handleViewEdgeTarget = useCallback(() => {
    if (!selectedEdge) return;
    handleDependencyClick(selectedEdge.target);
  }, [handleDependencyClick, selectedEdge]);
  const handleCloseSidebar = () => {
    setFocusedFilePath(null); setSelectedNodeId(null); setSelectedEdgeId(null); clearGroupSelection();
  };
  const handleMapPaneClick = useCallback((event: MouseEvent) => {
    setSelectedNodeId(null); setSelectedEdgeId(null); clearGroupSelection(); setSelectedCommentId(null); handlePaneClick(event);
  }, [clearGroupSelection, handlePaneClick]);
  const handleToggleReadOnly = useCallback(() => {
    setReadOnly((current) => !current);
  }, []);
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
    <div className="h-screen flex flex-col bg-background">
      <SearchPalette open={searchOpen} query={searchQuery} results={searchResults} warning={searchWarning} onOpenChange={setSearchOpen} onQueryChange={setSearchQuery} onSelectResult={onSearchSelect} />
      <MapHeader viewMode={viewMode} selectedLayer={selectedLayer} selectedGroupId={selectedGroupId} groups={data.groups} missingGroupFeatures={missingGroupFeatures} hasGroups={hasGroups} context={data.context} showComments={showComments} layoutMessage={layoutMessage} onPackGroups={packGroups} onViewModeChange={setViewMode} onLayerChange={setSelectedLayer} onGroupChange={setSelectedGroupId} onToggleComments={() => setShowComments((current) => !current)} onAutoLayout={handleAutoLayout} onRefresh={loadData} />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative">
          <LeftToolbar onSearchClick={() => setSearchOpen(true)} commentMode={commentToolMode} onToggleAddMode={togglePlacementMode} edgeStyle={edgeStyle} onEdgeStyleChange={setEdgeStyle} />
          <FeatureMap graph={visibleGraph} entities={data.entities} viewMode={viewMode} layoutPositions={layoutPositions} groups={data.groups} groupMembership={groupMembership} selectedGroupId={selectedGroupId} selectedGroupDetailsId={selectedGroupDetailsId} onGroupSelect={handleGroupSelect} commentNodes={commentElements.nodes} commentEdges={commentElements.edges} onNodeClick={handleNodeClick} onPaneClick={handleMapPaneClick} onConnect={handleConnect} onEdgeClick={handleEdgeClick} onEdgeRemove={handleEdgeRemove} onNodeDragStop={handleNodeDragStop} onNodeRemove={handleNodeRemove} onGroupDragStop={handleGroupDragStop} commentPlacementActive={placementActive} onInit={setReactFlowInstance} selectedNodeId={selectedNodeId} selectedEdgeId={selectedEdgeId} connectedEdgeIds={connectedEdgeIds} connectedNodeIds={connectedNodeIds} hiddenNodeIds={hiddenNodeIds} focusedNodeId={focusedNodeId} focusedUntil={focusedUntil} readOnly={readOnly} onToggleReadOnly={handleToggleReadOnly} edgeStyle={edgeStyle} collapsedGroupIds={collapsedGroupIds} onGroupCollapseToggle={handleGroupCollapseToggle} />
        </main>
        {selectedEdge ? (
          <EdgeDetailsPanel
            edgeId={selectedEdgeStorageId}
            sourceLabel={selectedEdgeSourceLabel}
            targetLabel={selectedEdgeTargetLabel}
            imports={selectedEdge.imports}
            onClose={() => setSelectedEdgeId(null)}
            onViewSource={handleViewEdgeSource}
            onViewTarget={handleViewEdgeTarget}
          />
        ) : (
          <Sidebar node={selectedNode} group={selectedGroupDetails} groupMembers={selectedGroupMembers} viewMode={viewMode} onClose={handleCloseSidebar} onGroupUpdated={handleGroupUpdated} onDependencyClick={handleDependencyClick} groups={data.groups} focusedFilePath={focusedFilePath} stats={projectStats} statistics={data.context.statistics} techStack={data.context.techStack} conventions={data.context.conventions} structure={data.context.structure} testing={data.context.testing} internalDependencies={selectedNodeDependencies} entities={data.entities} />
        )}
      </div>
    </div>
  );
}

export default App;
