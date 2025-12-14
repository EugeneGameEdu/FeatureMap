import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <Card className="w-96">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>FeatureMap</CardTitle>
            <Badge>MVP</Badge>
          </div>
          <CardDescription>
            Visual feature map for your codebase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            shadcn/ui components are ready!
          </p>
          <Button className="w-full">Get Started</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
