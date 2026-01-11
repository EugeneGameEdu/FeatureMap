import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LoadingScreen() {
  return (
    <div className="h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-2 text-muted-foreground">
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
    <div className="h-screen bg-background flex items-center justify-center">
      <div className="bg-card border border-border p-6 rounded-lg shadow">
        <h2 className="text-destructive font-bold mb-2">Error</h2>
        <p className="text-muted-foreground mb-4">{message}</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}
