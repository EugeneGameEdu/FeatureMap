import { ArrowRight, FileCode, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  return (
    <div className="w-[400px] border-l border-border bg-card flex flex-col">
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
                <div className="space-y-3">
                  {imports.map((detail, index) => (
                    <div key={`${detail.symbol}-${index}`} className="border border-border rounded-lg p-3 bg-background/40">
                      <Badge variant="secondary" className="font-mono text-xs mb-2">
                        {detail.symbol}
                      </Badge>

                      {detail.targetFile && (
                        <div className="text-xs text-muted-foreground mb-2">
                          <span>Exported from:</span>
                          <div className="font-mono text-foreground/90 mt-1" title={detail.targetFile}>
                            {formatFilePath(detail.targetFile)}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        <span>Used in:</span>
                        <div className="mt-1 space-y-1">
                          {detail.sourceFiles.map((file, fileIndex) => (
                            <div key={`${file}-${fileIndex}`} className="flex items-start gap-1">
                              <FileCode size={12} className="text-muted-foreground mt-0.5" />
                              <span className="font-mono text-foreground/90" title={file}>
                                {formatFilePath(file)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
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
    </div>
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
