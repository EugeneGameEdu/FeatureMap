import { AlertTriangle, ArrowRight, Clock, Layers, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { GroupDetailsPanel } from '@/components/GroupDetailsPanel';
import { ProjectOverview, type ProjectStats } from '@/components/ProjectOverview';
import { SidebarClusterDetails } from '@/components/SidebarClusterDetails';
import type { Cluster, FeatureDetails, GroupSummary, MapEntity, ViewMode } from '@/lib/types';
import { formatDate } from '@/lib/loadFeatureMap';
import { getGroupsForFeature } from '@/lib/groupFilters';
import type { GroupMember } from '@/lib/groupMembership';
import type {
  ContextFile,
  Conventions,
  Statistics,
  Structure,
  TechStack,
  Testing,
} from '@/lib/contextTypes';

interface SidebarProps {
  node: MapEntity | null;
  group?: GroupSummary | null;
  groupMembers?: GroupMember[];
  viewMode?: ViewMode;
  onClose: () => void;
  onGroupUpdated?: (groupId: string, note: string | null) => void;
  onDependencyClick?: (featureId: string) => void;
  groups?: GroupSummary[];
  focusedFilePath?: string | null;
  stats?: ProjectStats;
  statistics?: ContextFile<Statistics>;
  techStack?: ContextFile<TechStack>;
  conventions?: ContextFile<Conventions>;
  structure?: ContextFile<Structure>;
  testing?: ContextFile<Testing>;
  internalDependencies?: string[];
  entities?: Record<string, MapEntity>;
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
  stats,
  statistics,
  techStack,
  conventions,
  structure,
  testing,
  internalDependencies,
  entities,
}: SidebarProps) {
  const sourceColors = {
    auto: 'bg-muted text-muted-foreground',
    ai: 'bg-emerald-500/20 text-emerald-200',
    user: 'bg-purple-500/20 text-purple-200',
  };
  const statusColors = {
    active: 'bg-primary/20 text-primary',
    deprecated: 'bg-amber-500/20 text-amber-200',
    ignored: 'bg-muted text-muted-foreground/80',
  };
  const layerColors = {
    frontend: 'bg-sky-500/20 text-sky-200',
    backend: 'bg-amber-500/20 text-amber-200',
    fullstack: 'bg-emerald-500/20 text-emerald-200',
    shared: 'bg-slate-500/20 text-slate-200',
    infrastructure: 'bg-indigo-500/20 text-indigo-200',
    smell: 'bg-rose-500/20 text-rose-200',
  };

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
  if (!node) {
    return (
      <div className="w-[350px] border-l border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Project Overview</h2>
        </div>
        <ScrollArea className="flex-1">
          <ProjectOverview
            stats={stats}
            statistics={statistics}
            techStack={techStack ?? { status: 'missing' }}
            conventions={conventions ?? { status: 'missing' }}
            structure={structure ?? { status: 'missing' }}
            testing={testing ?? { status: 'missing' }}
          />
        </ScrollArea>
      </div>
    );
  }

  let featureData: FeatureDetails | undefined;
  let clusterData: Cluster | undefined;

  if (isFeatureEntity(node)) {
    featureData = node.data;
  } else {
    clusterData = node.data;
  }
  const title = featureData ? featureData.name : node.label;
  const description = featureData
    ? featureData.description ?? featureData.purpose
    : clusterData?.purpose_hint;
  const featureSource = featureData ? resolveFeatureSource(featureData) : 'auto';
  const featureGroups = featureData ? getGroupsForFeature(groups, featureData.id) : [];

  return (
    <div className="w-[350px] border-l border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-2">
            <h2 className="font-semibold text-foreground">{title}</h2>
            <div className="flex gap-2 mt-2">
              {featureData ? (
                <>
                  <Badge variant="outline" className={sourceColors[featureSource]}>
                    {featureSource}
                  </Badge>
                  <Badge variant="outline" className={statusColors[featureData.status]}>
                    {featureData.status}
                  </Badge>
                </>
              ) : (
                <>
                  <Badge variant="outline" className={layerColors[clusterData?.layer ?? 'shared']}>
                    {clusterData?.layer ?? 'shared'}
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
              <p className="text-sm text-muted-foreground">{description}</p>
            </section>
          ) : (
            <section>
              <p className="text-sm text-muted-foreground/80 italic">
                No description yet.
              </p>
            </section>
          )}

          {featureData ? (
            <section>
              <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Layers size={16} />
                Clusters ({featureData.clustersDetailed.length})
              </h3>
              <div className="space-y-2">
                {featureData.clustersDetailed.map((cluster) => (
                  <div
                    key={cluster.id}
                    className="rounded border border-border bg-muted px-2 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => onDependencyClick?.(cluster.id)}
                        className="text-left text-sm text-primary hover:text-primary/80"
                      >
                        {cluster.id}
                      </button>
                      {cluster.missing && (
                        <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/40">
                          <AlertTriangle size={12} className="mr-1" />
                          missing
                        </Badge>
                      )}
                    </div>
                    {!cluster.missing && (
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                        {cluster.layer && (
                          <span className="capitalize text-muted-foreground">{cluster.layer}</span>
                        )}
                        {cluster.fileCount !== undefined && (
                          <span>{cluster.fileCount} files</span>
                        )}
                      </div>
                    )}
                    {cluster.purpose_hint && (
                      <p className="text-xs text-muted-foreground mt-1">{cluster.purpose_hint}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            clusterData && (
              <SidebarClusterDetails
                cluster={clusterData}
                focusedFilePath={focusedFilePath}
                internalDependencies={internalDependencies}
                entities={entities}
                onDependencyClick={onDependencyClick}
              />
            )
          )}

          {featureData && featureGroups.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
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

          {featureData && featureData.dependsOn && featureData.dependsOn.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <ArrowRight size={16} />
                Depends On ({featureData.dependsOn.length})
              </h3>
              <div className="space-y-1">
                {featureData.dependsOn.map((dep) => (
                  <button
                    key={dep}
                    onClick={() => onDependencyClick?.(dep)}
                    className="w-full text-left text-sm text-primary hover:text-primary/80 py-1.5 px-2 bg-primary/10 rounded hover:bg-primary/20 transition-colors"
                  >
                    {'-> '}
                    {dep}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="pt-4 border-t border-border">
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Clock size={16} />
              Metadata
            </h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Created: {formatDate(node.data.metadata.createdAt)}</p>
              <p>Updated: {formatDate(node.data.metadata.updatedAt)}</p>
              <p className="font-mono text-muted-foreground/80">ID: {node.data.id}</p>
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

function isFeatureEntity(entity: MapEntity): entity is Extract<MapEntity, { kind: 'feature' }> {
  return entity.kind === 'feature';
}
