import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { SearchIndexEntry } from '@/lib/searchIndex';

interface SearchWarning {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface SearchPaletteProps {
  open: boolean;
  query: string;
  results: SearchIndexEntry[];
  warning?: SearchWarning | null;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (value: string) => void;
  onSelectResult: (result: SearchIndexEntry) => void;
}

export function SearchPalette({
  open,
  query,
  results,
  warning,
  onOpenChange,
  onQueryChange,
  onSelectResult,
}: SearchPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const showResults = query.trim().length >= 2;

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search size={16} className="text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search features, clusters, files..."
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none"
          />
        </div>

        {warning && (
          <div className="flex items-center justify-between gap-3 border-b bg-amber-50 px-4 py-2 text-xs text-amber-700">
            <span>{warning.message}</span>
            {warning.actionLabel && warning.onAction && (
              <Button variant="ghost" size="sm" onClick={warning.onAction}>
                {warning.actionLabel}
              </Button>
            )}
          </div>
        )}

        <div className="max-h-72 overflow-y-auto">
          {!showResults && (
            <div className="px-4 py-6 text-sm text-gray-400">
              Type at least 2 characters to search.
            </div>
          )}
          {showResults && results.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-400">No matches.</div>
          )}
          {showResults && results.length > 0 && (
            <div className="py-1">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => onSelectResult(result)}
                  className="w-full px-4 py-2 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {result.title}
                      </div>
                      {result.subtitle && (
                        <div className="text-xs text-gray-500 truncate">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] uppercase text-gray-400">
                      {result.type}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
