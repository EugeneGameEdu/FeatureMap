import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

type DragState = {
  startX: number;
  startWidth: number;
};

interface ResizableSidebarProps {
  children: ReactNode;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function ResizableSidebar({
  children,
  initialWidth = 350,
  minWidth = 320,
  maxWidth,
  className,
}: ResizableSidebarProps) {
  const resolvedMaxWidth = maxWidth ?? Math.round(initialWidth * 2);
  const [width, setWidth] = useState(() =>
    clamp(initialWidth, minWidth, resolvedMaxWidth)
  );
  const dragStateRef = useRef<DragState | null>(null);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      dragStateRef.current = { startX: event.clientX, startWidth: width };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [width]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current) {
        return;
      }
      const delta = dragStateRef.current.startX - event.clientX;
      const nextWidth = clamp(
        dragStateRef.current.startWidth + delta,
        minWidth,
        resolvedMaxWidth
      );
      setWidth(nextWidth);
    },
    [minWidth, resolvedMaxWidth]
  );

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) {
      return;
    }
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div
      className={cn('relative border-l border-border bg-card flex flex-col', className)}
      style={{ width, minWidth, maxWidth: resolvedMaxWidth }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        className="absolute left-0 top-0 h-full w-6 -translate-x-1/2 cursor-col-resize"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted p-1 text-muted-foreground shadow-sm">
          <GripVertical size={14} />
        </div>
      </div>
      {children}
    </div>
  );
}
