import { useEffect, useMemo, useState } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import { RefreshCw } from 'lucide-react';
import { FeatureMap } from '@/components/FeatureMap';
import { Sidebar } from '@/components/Sidebar';
import { LeftToolbar } from '@/components/LeftToolbar';
import { MapHeader } from '@/components/MapHeader';
import { SearchPalette } from '@/components/SearchPalette';
import { Button } from '@/components/ui/button';
import { applyGroupFilter } from '@/lib/groupFilters';
import { loadFeatureMap } from '@/lib/loadFeatureMap';
import { applyLayerFilter } from '@/lib/layerFilters';
import { useSearchNavigation } from '@/lib/useSearchNavigation';
import type { FeatureMapData, LayerFilter, ViewMode } from '@/lib/types';

function App() {
  const [data, setData] = useState<FeatureMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('clusters');
  const [selectedLayer, setSelectedLayer] = useState<LayerFilter>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
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
  }, [activeGraph, data, selectedGroupId, selectedLayer, viewMode]);
  const visibleNodeIds = useMemo(
    () => new Set(visibleGraph?.nodes.map((node) => node.id) ?? []),
    [visibleGraph]
  );

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

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const featureMap = await loadFeatureMap();
      setData(featureMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
    if (!data) {
      return;
    }
    if (selectedGroupId !== 'all' && !data.groupsById[selectedGroupId]) {
      setSelectedGroupId('all');
    }
  }, [data, selectedGroupId]);

  const handleNodeClick = (nodeId: string) => {
    setFocusedFilePath(null);
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
    setFocusedFilePath(null);
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
        generatedAt={data.graph.generatedAt}
        viewMode={viewMode}
        selectedLayer={selectedLayer}
        selectedGroupId={selectedGroupId}
        groups={data.groups}
        missingGroupFeatures={missingGroupFeatures}
        hasGroups={hasGroups}
        context={data.context}
        onViewModeChange={setViewMode}
        onLayerChange={setSelectedLayer}
        onGroupChange={setSelectedGroupId}
        onRefresh={loadData}
      />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative">
          <LeftToolbar onSearchClick={() => setSearchOpen(true)} />
          <FeatureMap
            graph={visibleGraph}
            entities={data.entities}
            onNodeClick={handleNodeClick}
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
