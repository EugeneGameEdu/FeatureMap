import { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, Search, Spline } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CommentToolMode } from '@/lib/commentsMode';
import type { EdgeStyle } from '@/lib/types';
import { cn } from '@/lib/utils';

interface LeftToolbarProps {
  onSearchClick: () => void;
  commentMode: CommentToolMode;
  onToggleAddMode: () => void;
  edgeStyle: EdgeStyle;
  onEdgeStyleChange: (style: EdgeStyle) => void;
}

const EDGE_STYLE_OPTIONS: Array<{ value: EdgeStyle; label: string }> = [
  { value: 'bezier', label: 'Bezier' },
  { value: 'straight', label: 'Straight' },
  { value: 'smoothstep', label: 'Step' },
];

export function LeftToolbar({
  onSearchClick,
  commentMode,
  onToggleAddMode,
  edgeStyle,
  onEdgeStyleChange,
}: LeftToolbarProps) {
  const [edgeMenuOpen, setEdgeMenuOpen] = useState(false);
  const edgeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!edgeMenuOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!edgeMenuRef.current) {
        return;
      }
      if (!edgeMenuRef.current.contains(event.target as Node)) {
        setEdgeMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [edgeMenuOpen]);

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
      <div ref={edgeMenuRef} className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setEdgeMenuOpen((open) => !open)}
          title="Link style"
          aria-label="Link style"
        aria-haspopup="menu"
        aria-expanded={edgeMenuOpen}
        className="relative"
      >
        <Spline size={18} />
      </Button>
        {edgeMenuOpen && (
          <div className="absolute left-full top-0 ml-2 w-36 rounded-lg border border-border bg-card/95 p-1 shadow-md">
            {EDGE_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onEdgeStyleChange(option.value);
                  setEdgeMenuOpen(false);
                }}
                className={cn(
                  'w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors',
                  'hover:bg-secondary/70',
                  option.value === edgeStyle && 'bg-secondary/80'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
