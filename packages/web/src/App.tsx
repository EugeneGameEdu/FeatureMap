import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { FeatureMap } from '@/components/FeatureMap';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { formatDate, loadFeatureMap } from '@/lib/loadFeatureMap';
import type { FeatureMapData, ViewMode } from '@/lib/types';

function App() {
  const [data, setData] = useState<FeatureMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('clusters');

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
    if (!data || !selectedNodeId) {
      return;
    }
    const graph = viewMode === 'clusters' ? data.clusterGraph : data.featureGraph;
    const exists = graph.nodes.some((node) => node.id === selectedNodeId);
    if (!exists) {
      setSelectedNodeId(null);
    }
  }, [data, selectedNodeId, viewMode]);

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

  if (!data) return null;

  const selectedNode = selectedNodeId ? data.entities[selectedNodeId] : null;
  const clusterCount = data.clusterGraph.nodes.length;
  const featureCount = data.featureGraph.nodes.length;
  const activeGraph = viewMode === 'clusters' ? data.clusterGraph : data.featureGraph;

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
          <div className="flex items-center gap-2 text-sm text-gray-500">
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
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw size={14} className="mr-1" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative">
          <FeatureMap
            graph={activeGraph}
            entities={data.entities}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedNodeId}
          />
        </main>

        <Sidebar
          node={selectedNode}
          onClose={handleCloseSidebar}
          onDependencyClick={handleDependencyClick}
        />
      </div>
    </div>
  );
}

export default App;
