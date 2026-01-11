import { useEffect, useRef } from 'react';
import { ArrowRight, FileCode, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Cluster, MapEntity } from '@/lib/types';

interface SidebarClusterDetailsProps {
  cluster: Cluster;
  focusedFilePath?: string | null;
  internalDependencies?: string[];
  entities?: Record<string, MapEntity>;
  onDependencyClick?: (featureId: string) => void;
}

export function SidebarClusterDetails({
  cluster,
  focusedFilePath,
  internalDependencies = [],
  entities,
  onDependencyClick,
}: SidebarClusterDetailsProps) {
  const fileRowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const internalDeps = Array.from(new Set(internalDependencies)).filter(
    (depId) => depId && depId !== cluster.id
  );
  const externalLibraries = cluster.imports?.external ?? [];

  useEffect(() => {
    fileRowRefs.current.clear();
  }, [cluster.id]);

  useEffect(() => {
    if (!focusedFilePath) {
      return;
    }
    const row = fileRowRefs.current.get(focusedFilePath);
    row?.scrollIntoView({ block: 'center' });
  }, [focusedFilePath]);

  return (
    <>
      <section>
        <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <FileCode size={16} />
          Files ({cluster.files.length})
        </h3>
        <div className="space-y-1">
          {cluster.files.map((file) => (
            <div
              key={file}
              ref={(element) => fileRowRefs.current.set(file, element)}
              className={`text-xs text-foreground/90 py-1.5 px-2 bg-muted rounded hover:bg-muted/80 font-mono ${
                focusedFilePath === file ? 'ring-1 ring-primary/40 bg-primary/10' : ''
              }`}
              title={file}
            >
              {file.split('/').slice(-2).join('/')}
            </div>
          ))}
        </div>
      </section>

      {internalDeps.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <ArrowRight size={16} />
            Dependencies ({internalDeps.length})
          </h3>
          <div className="space-y-1">
            {internalDeps.map((depId) => {
              const depEntity = entities?.[depId];
              const depLabel = depEntity?.label ?? depId;

              return (
                <button
                  key={depId}
                  onClick={() => onDependencyClick?.(depId)}
                  className="w-full text-left text-sm text-primary hover:text-primary/80 py-1.5 px-2 bg-primary/10 rounded hover:bg-primary/20 transition-colors"
                >
                  {'-> '}
                  {depLabel}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {externalLibraries.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Package size={16} />
            External Libraries ({externalLibraries.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {externalLibraries.map((lib) => (
              <Badge key={lib} variant="secondary" className="font-mono text-xs">
                {lib}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
