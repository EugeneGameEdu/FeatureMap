import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LeftToolbarProps {
  onSearchClick: () => void;
}

export function LeftToolbar({ onSearchClick }: LeftToolbarProps) {
  return (
    <div className="absolute left-3 top-16 z-20 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        onClick={onSearchClick}
        title="Search"
        aria-label="Search"
      >
        <Search size={18} />
      </Button>
    </div>
  );
}
