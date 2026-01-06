import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { FeatureMap } from '@/components/FeatureMap';
import { ContextViewer } from '@/components/ContextViewer';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { applyGroupFilter } from '@/lib/groupFilters';
import { formatDate, loadFeatureMap } from '@/lib/loadFeatureMap';
import { applyLayerFilter, getLayerOrder } from '@/lib/layerFilters';
import type { FeatureMapData, LayerFilter, ViewMode } from '@/lib/types';

const LAYER_FILTERS: Array<{ value: LayerFilter; label: string }> = [
  { value: 'all', label: 'All' },
  ...getLayerOrder().map((layer) => ({
    value: layer,
    label: `${layer[0].toUpperCase()}${layer.slice(1)}`,
  })),
];

function App() {
  const [data, setData] = useState<FeatureMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('clusters');
  const [selectedLayer, setSelectedLayer] = useState<LayerFilter>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

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
    setSelectedNodeId(nodeId);
  };

  const handleCloseSidebar = () => {
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
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">FeatureMap</h1>
          <p className="text-sm text-gray-500">
            {clusterCount} clusters, {featureCount} features - Updated {formatDate(data.graph.generatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-2 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span>View:</span>
              <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                <Button
                  variant={viewMode === 'clusters' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('clusters')}
                >
                  Clusters
                </Button>
                <Button
                  variant={viewMode === 'features' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('features')}
                >
                  Features
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span>Layer:</span>
              <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                {LAYER_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    variant={selectedLayer === filter.value ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedLayer(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span>Group:</span>
              <select
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700"
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
                disabled={!hasGroups}
              >
                <option value="all">All groups</option>
                {data.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.featureIds.length})
                  </option>
                ))}
              </select>
            </div>
            {missingGroupFeatures.length > 0 && (
              <div className="text-xs text-amber-600">
                Missing features in group: {missingGroupFeatures.join(', ')}
              </div>
            )}
          </div>
          <ContextViewer context={data.context} />
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw size={14} className="mr-1" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative">
          <FeatureMap
            graph={visibleGraph}
            entities={data.entities}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedNodeId}
          />
        </main>

        <Sidebar
          node={selectedNode}
          onClose={handleCloseSidebar}
          onDependencyClick={handleDependencyClick}
          groups={data.groups}
        />
      </div>
    </div>
  );
}

export default App;
