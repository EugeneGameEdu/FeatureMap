import { MessageSquarePlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CommentToolMode } from '@/lib/commentsMode';
import { getCommentModeLabel } from '@/lib/commentsMode';

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
  const modeLabel = getCommentModeLabel(commentMode);
  return (
    <div className="absolute left-4 top-20 z-20 flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white/95 p-2 shadow-md backdrop-blur">
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
        variant={commentMode === 'off' ? 'ghost' : 'secondary'}
        size="icon"
        onClick={onToggleAddMode}
        title="Add comment"
        aria-label="Add comment"
        aria-pressed={commentMode !== 'off'}
      >
        <MessageSquarePlus size={18} />
      </Button>
      {modeLabel && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
          {modeLabel}
        </span>
      )}
    </div>
  );
}
