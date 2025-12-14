import { ArrowRight, Clock, FileCode, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Feature } from '@/lib/types';
import { formatDate } from '@/lib/loadFeatureMap';

interface SidebarProps {
  feature: Feature | null;
  open: boolean;
  onClose: () => void;
  onDependencyClick?: (featureId: string) => void;
}

export function Sidebar({ feature, open, onClose, onDependencyClick }: SidebarProps) {
  if (!feature) return null;

  const sourceColors = {
    auto: 'bg-gray-100 text-gray-700',
    ai: 'bg-green-100 text-green-700',
    manual: 'bg-purple-100 text-purple-700',
  };

  const statusColors = {
    active: 'bg-blue-100 text-blue-700',
    deprecated: 'bg-amber-100 text-amber-700',
    ignored: 'bg-gray-100 text-gray-500',
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[400px] sm:w-[450px] p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <SheetTitle className="text-lg font-semibold">{feature.name}</SheetTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className={sourceColors[feature.source]}>
                  {feature.source}
                </Badge>
                <Badge variant="outline" className={statusColors[feature.status]}>
                  {feature.status}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-4 space-y-6">
            {feature.description ? (
              <section>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </section>
            ) : (
              <section>
                <p className="text-sm text-gray-400 italic">
                  No description yet. Use AI analysis to generate one.
                </p>
              </section>
            )}

            <section>
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <FileCode size={16} />
                Files ({feature.files.length})
              </h3>
              <div className="space-y-1">
                {feature.files.map((file, index) => (
                  <div
                    key={index}
                    className="text-sm text-gray-600 py-1.5 px-2 bg-gray-50 rounded hover:bg-gray-100 font-mono text-xs"
                  >
                    {file.path.split('/').slice(-2).join('/')}
                    {file.role && <span className="text-gray-400 ml-2">— {file.role}</span>}
                  </div>
                ))}
              </div>
            </section>

            {feature.exports && feature.exports.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Tag size={16} />
                  Exports ({feature.exports.length})
                </h3>
                <div className="flex flex-wrap gap-1">
                  {feature.exports.map((exp, index) => (
                    <Badge key={index} variant="secondary" className="font-mono text-xs">
                      {exp}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {feature.dependsOn && feature.dependsOn.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <ArrowRight size={16} />
                  Depends On ({feature.dependsOn.length})
                </h3>
                <div className="space-y-1">
                  {feature.dependsOn.map((dep, index) => (
                    <button
                      key={index}
                      onClick={() => onDependencyClick?.(dep)}
                      className="w-full text-left text-sm text-blue-600 hover:text-blue-800 py-1.5 px-2 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                    >
                      → {dep}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Clock size={16} />
                Metadata
              </h3>
              <div className="text-xs text-gray-500 space-y-1">
                <p>Created: {formatDate(feature.metadata.createdAt)}</p>
                <p>Updated: {formatDate(feature.metadata.updatedAt)}</p>
                <p className="font-mono text-gray-400">ID: {feature.id}</p>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
