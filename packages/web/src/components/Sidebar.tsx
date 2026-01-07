import { useEffect, useRef } from 'react';
import { AlertTriangle, ArrowRight, Clock, FileCode, Layers, Tag, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { GroupDetailsPanel } from '@/components/GroupDetailsPanel';
import type { FeatureDetails, GroupSummary, MapEntity, ViewMode } from '@/lib/types';
import { formatDate } from '@/lib/loadFeatureMap';
import { getGroupsForFeature } from '@/lib/groupFilters';
import type { GroupMember } from '@/lib/groupMembership';

interface SidebarProps {
  node: MapEntity | null;
  group?: GroupSummary | null;
  groupMembers?: GroupMember[];
  viewMode?: ViewMode;
  onClose: () => void;
  onGroupUpdated?: () => void;
  onDependencyClick?: (featureId: string) => void;
  groups?: GroupSummary[];
  focusedFilePath?: string | null;
}

export function Sidebar({
  node,
  group,
  groupMembers = [],
  viewMode = 'clusters',
  onClose,
  onGroupUpdated,
  onDependencyClick,
  groups = [],
  focusedFilePath,
}: SidebarProps) {
  const sourceColors = {
    auto: 'bg-gray-100 text-gray-700',
    ai: 'bg-green-100 text-green-700',
    user: 'bg-purple-100 text-purple-700',
  };
  const statusColors = {
    active: 'bg-blue-100 text-blue-700',
    deprecated: 'bg-amber-100 text-amber-700',
    ignored: 'bg-gray-100 text-gray-500',
  };
  const layerColors = {
    frontend: 'bg-blue-100 text-blue-700',
    backend: 'bg-amber-100 text-amber-700',
    shared: 'bg-gray-100 text-gray-600',
    infrastructure: 'bg-indigo-100 text-indigo-700',
  };
  const fileRowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  useEffect(() => {
    fileRowRefs.current.clear();
  }, [node?.data.id]);

  useEffect(() => {
    if (!focusedFilePath || !node || node.kind !== 'cluster') {
      return;
    }
    const row = fileRowRefs.current.get(focusedFilePath);
    row?.scrollIntoView({ block: 'center' });
  }, [focusedFilePath, node]);

  if (!node && !group) {
    return (
      <div className="w-[350px] border-l bg-white flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-400">Details</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-gray-400 text-center">
            Click on a node to see details
          </p>
        </div>
      </div>
    );
  }
  if (group) {
    return (
      <GroupDetailsPanel
        group={group}
        groupMembers={groupMembers}
        viewMode={viewMode}
        onClose={onClose}
        onGroupUpdated={onGroupUpdated}
      />
    );
  }
  const isFeature = node.kind === 'feature';
  const title = isFeature ? node.data.name : node.label;
  const description = isFeature ? node.data.description ?? node.data.purpose : node.data.purpose_hint;
  const featureSource = isFeature ? resolveFeatureSource(node.data) : 'auto';
  const featureGroups = isFeature ? getGroupsForFeature(groups, node.data.id) : [];

  return (
    <div className="w-[350px] border-l bg-white flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-2">
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <div className="flex gap-2 mt-2">
              {isFeature ? (
                <>
                  <Badge variant="outline" className={sourceColors[featureSource]}>
                    {featureSource}
                  </Badge>
                  <Badge variant="outline" className={statusColors[node.data.status]}>
                    {node.data.status}
                  </Badge>
                </>
              ) : (
                <>
                  <Badge variant="outline" className={layerColors[node.data.layer]}>
                    {node.data.layer}
                  </Badge>
                  <Badge variant="outline">cluster</Badge>
                </>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X size={16} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {description ? (
            <section>
              <p className="text-sm text-gray-600">{description}</p>
            </section>
          ) : (
            <section>
              <p className="text-sm text-gray-400 italic">
                No description yet.
              </p>
            </section>
          )}

          {isFeature ? (
            <section>
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Layers size={16} />
                Clusters ({node.data.clustersDetailed.length})
              </h3>
              <div className="space-y-2">
                {node.data.clustersDetailed.map((cluster) => (
                  <div
                    key={cluster.id}
                    className="rounded border border-gray-100 bg-gray-50 px-2 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => onDependencyClick?.(cluster.id)}
                        className="text-left text-sm text-blue-600 hover:text-blue-800"
                      >
                        {cluster.id}
                      </button>
                      {cluster.missing && (
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                          <AlertTriangle size={12} className="mr-1" />
                          missing
                        </Badge>
                      )}
                    </div>
                    {!cluster.missing && (
                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                        {cluster.layer && (
                          <span className="capitalize text-gray-500">{cluster.layer}</span>
                        )}
                        {cluster.fileCount !== undefined && (
                          <span>{cluster.fileCount} files</span>
                        )}
                      </div>
                    )}
                    {cluster.purpose_hint && (
                      <p className="text-xs text-gray-500 mt-1">{cluster.purpose_hint}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section>
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <FileCode size={16} />
                Files ({node.data.files.length})
              </h3>
              <div className="space-y-1">
                {node.data.files.map((file, index) => (
                  <div
                    key={index}
                    ref={(element) => fileRowRefs.current.set(file, element)}
                    className={`text-xs text-gray-600 py-1.5 px-2 bg-gray-50 rounded hover:bg-gray-100 font-mono ${
                      focusedFilePath === file ? 'ring-1 ring-amber-200 bg-amber-50' : ''
                    }`}
                    title={file}
                  >
                    {file.split('/').slice(-2).join('/')}
                  </div>
                ))}
              </div>
            </section>
          )}

          {isFeature && featureGroups.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Layers size={16} />
                Groups ({featureGroups.length})
              </h3>
              <div className="flex flex-wrap gap-1">
                {featureGroups.map((group) => (
                  <Badge key={group.id} variant="secondary" className="text-xs">
                    {group.name}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {!isFeature && node.data.exports.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Tag size={16} />
                Exports ({node.data.exports.length})
              </h3>
              <div className="flex flex-wrap gap-1">
                {node.data.exports.map((exp, index) => (
                  <Badge key={`${exp.name}-${index}`} variant="secondary" className="font-mono text-xs">
                    {exp.name}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {isFeature && node.data.dependsOn && node.data.dependsOn.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <ArrowRight size={16} />
                Depends On ({node.data.dependsOn.length})
              </h3>
              <div className="space-y-1">
                {node.data.dependsOn.map((dep) => (
                  <button
                    key={dep}
                    onClick={() => onDependencyClick?.(dep)}
                    className="w-full text-left text-sm text-blue-600 hover:text-blue-800 py-1.5 px-2 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                  >
                    {'-> '}
                    {dep}
                  </button>
                ))}
              </div>
            </section>
          )}

          {!isFeature && node.data.imports.external.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <ArrowRight size={16} />
                External Imports ({node.data.imports.external.length})
              </h3>
              <div className="flex flex-wrap gap-1">
                {node.data.imports.external.map((imp) => (
                  <Badge key={imp} variant="secondary" className="font-mono text-xs">
                    {imp}
                  </Badge>
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
              <p>Created: {formatDate(node.data.metadata.createdAt)}</p>
              <p>Updated: {formatDate(node.data.metadata.updatedAt)}</p>
              <p className="font-mono text-gray-400">ID: {node.data.id}</p>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function resolveFeatureSource(feature: FeatureDetails): 'auto' | 'ai' | 'user' {
  if (feature.metadata.lastModifiedBy === 'ai' || feature.source === 'ai') {
    return 'ai';
  }

  return feature.source === 'user' ? 'user' : 'auto';
}
