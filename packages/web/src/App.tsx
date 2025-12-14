import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, loadFeatureMap } from '@/lib/loadFeatureMap';
import type { FeatureMapData } from '@/lib/types';

function App() {
  const [data, setData] = useState<FeatureMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading feature map...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadData}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">FeatureMap</h1>
          <p className="text-gray-600">
            {data.graph.nodes.length} features • Updated {formatDate(data.graph.generatedAt)}
          </p>
        </div>

        <div className="grid gap-4">
          {data.graph.nodes.map((node) => {
            const feature = data.features[node.id];
            return (
              <Card key={node.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{node.label}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline">{node.fileCount} files</Badge>
                      {feature?.source && (
                        <Badge variant={feature.source === 'auto' ? 'secondary' : 'default'}>
                          {feature.source}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {feature?.description && (
                    <CardDescription>{feature.description}</CardDescription>
                  )}
                </CardHeader>
                {feature && (
                  <CardContent>
                    <p className="text-sm text-gray-500">
                      Files: {feature.files.map(f => f.path.split('/').pop()).join(', ')}
                    </p>
                    {feature.dependsOn.length > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        Depends on: {feature.dependsOn.join(', ')}
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
