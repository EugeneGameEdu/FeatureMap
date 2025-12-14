import { useEffect, useState } from 'react';
import { FeatureMap } from '@/components/FeatureMap';
import { formatDate, loadFeatureMap } from '@/lib/loadFeatureMap';
import type { FeatureMapData } from '@/lib/types';

function App() {
  const [data, setData] = useState<FeatureMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading feature map...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-red-600 font-bold mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">FeatureMap</h1>
          <p className="text-sm text-gray-500">
            {data.graph.nodes.length} features • Updated {formatDate(data.graph.generatedAt)}
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          Refresh
        </button>
      </header>

      <main className="flex-1">
        <FeatureMap
          graph={data.graph}
          features={data.features}
          onNodeClick={(id) => {
            setSelectedFeature(id);
            console.log('Selected feature:', id, data.features[id]);
          }}
        />
      </main>

      {selectedFeature && (
        <div className="absolute bottom-4 left-4 bg-white p-3 rounded shadow text-sm">
          Selected: <strong>{selectedFeature}</strong>
        </div>
      )}
    </div>
  );
}

export default App;
