import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizableSidebar } from '@/components/ResizableSidebar';
import type { EdgeImportDetail } from '@/lib/types';
import { cn } from '@/lib/utils';

interface EdgeDetailsPanelProps {
  sourceLabel: string;
  targetLabel: string;
  imports?: EdgeImportDetail[];
  onClose: () => void;
  onViewSource?: () => void;
  onViewTarget?: () => void;
}

export function EdgeDetailsPanel({
  sourceLabel,
  targetLabel,
  imports = [],
  onClose,
  onViewSource,
  onViewTarget,
}: EdgeDetailsPanelProps) {
  const totalSourceFiles = imports.reduce((sum, detail) => sum + detail.sourceFiles.length, 0);
  const [expandedImports, setExpandedImports] = useState<Set<string>>(() => new Set());

  const toggleImport = (key: string) => {
    setExpandedImports((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <ResizableSidebar initialWidth={400}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-foreground">Connection Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close edge details">
            <X size={16} />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={onViewSource}
            disabled={!onViewSource}
            className={cn(
              'font-medium text-primary transition-colors hover:text-primary/90',
              !onViewSource && 'opacity-60 cursor-not-allowed hover:text-primary'
            )}
          >
            {sourceLabel}
          </button>
          <ArrowRight size={14} className="text-muted-foreground" />
          <button
            type="button"
            onClick={onViewTarget}
            disabled={!onViewTarget}
            className={cn(
              'font-medium text-primary transition-colors hover:text-primary/90',
              !onViewTarget && 'opacity-60 cursor-not-allowed hover:text-primary'
            )}
          >
            {targetLabel}
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {imports.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No detailed import information available.
            </p>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">
                  Imports ({imports.length})
                </h3>
                <div className="space-y-2">
                  {imports.map((detail, index) => {
                    const key = `${detail.symbol}|${detail.targetFile ?? ''}|${index}`;
                    const isExpanded = expandedImports.has(key);
                    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

                    return (
                      <div key={key} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleImport(key)}
                          className="flex items-center gap-2 text-left w-full"
                          aria-expanded={isExpanded}
                        >
                          <ChevronIcon size={16} className="text-muted-foreground" />
                          <span className="text-sm font-semibold text-primary">
                            {detail.symbol}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="pl-6 space-y-2">
                            {detail.targetFile && (
                              <div className="text-xs text-muted-foreground">
                                <div>Exported from:</div>
                                <div className="font-mono" title={detail.targetFile}>
                                  {formatFilePath(detail.targetFile)}
                                </div>
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              <div>Used in:</div>
                              <div className="space-y-1">
                                {detail.sourceFiles.map((file, fileIndex) => (
                                  <div key={`${file}-${fileIndex}`} className="font-mono" title={file}>
                                    {formatFilePath(file)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                <div>Files importing: {totalSourceFiles}</div>
                <div>Symbols imported: {imports.length}</div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </ResizableSidebar>
  );
}

function formatFilePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length <= 2) {
    return normalized;
  }
  return segments.slice(-2).join('/');
}
