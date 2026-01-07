import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LoadingScreen() {
  return (
    <div className="h-screen bg-gray-100 flex items-center justify-center">
      <div className="flex items-center gap-2 text-gray-600">
        <RefreshCw className="animate-spin" size={20} />
        <span>Loading feature map...</span>
      </div>
    </div>
  );
}

interface ErrorScreenProps {
  message: string;
  onRetry: () => void;
}

export function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
  return (
    <div className="h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-red-600 font-bold mb-2">Error</h2>
        <p className="text-gray-600 mb-4">{message}</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}
