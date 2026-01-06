import { MessageSquare, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LeftToolbarProps {
  onSearchClick: () => void;
  showComments: boolean;
  onToggleComments: () => void;
}

export function LeftToolbar({
  onSearchClick,
  showComments,
  onToggleComments,
}: LeftToolbarProps) {
  return (
    <div className="absolute left-4 top-20 z-20 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white/95 p-2 shadow-md backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        onClick={onSearchClick}
        title="Search"
        aria-label="Search"
      >
        <Search size={18} />
      </Button>
      <Button
        variant={showComments ? 'secondary' : 'ghost'}
        size="icon"
        onClick={onToggleComments}
        title="Toggle comments"
        aria-label="Toggle comments"
        aria-pressed={showComments}
      >
        <MessageSquare size={18} />
      </Button>
    </div>
  );
}
