import { MessageSquarePlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CommentToolMode } from '@/lib/commentsMode';

interface LeftToolbarProps {
  onSearchClick: () => void;
  commentMode: CommentToolMode;
  onToggleAddMode: () => void;
}

export function LeftToolbar({
  onSearchClick,
  commentMode,
  onToggleAddMode,
}: LeftToolbarProps) {
  return (
    <div className="absolute left-4 top-20 z-20 flex flex-col items-center gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-md backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        onClick={onSearchClick}
        title="Search"
        aria-label="Search"
      >
        <Search size={18} />
      </Button>
      <div className="relative">
        <Button
          variant={commentMode === 'off' ? 'ghost' : 'secondary'}
          size="icon"
          onClick={onToggleAddMode}
          title="Place comment"
          aria-label="Place comment"
          aria-pressed={commentMode !== 'off'}
        >
          <MessageSquarePlus size={18} />
        </Button>
        {commentMode === 'place' && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
        )}
      </div>
    </div>
  );
}
