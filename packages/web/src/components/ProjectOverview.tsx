import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Code, FileText, FolderTree, Package, TestTube2, ChevronDown } from 'lucide-react';
import type {
  ContextFile,
  Conventions,
  ContextStatus,
  Statistics,
  Structure,
  TechStack,
  Testing,
} from '@/lib/contextTypes';
import { formatDate } from '@/lib/loadFeatureMap';
const PRIMARY_FRAMEWORK_CATEGORIES = new Set([
  'UI Framework',
  'Web Server',
  'UI Components',
  'Visualization',
  'AI Integration',
  'CLI',
]);
export type ProjectStats = {
  clusters: number;
  features: number;
  files: number;
  connections: number;
  updatedAt?: string;
};
interface ProjectOverviewProps {
  stats?: ProjectStats;
  statistics?: ContextFile<Statistics>;
  techStack: ContextFile<TechStack>;
  conventions: ContextFile<Conventions>;
  structure?: ContextFile<Structure>;
  testing?: ContextFile<Testing>;
}
export function ProjectOverview({
  stats,
  statistics,
  techStack,
  conventions,
  structure,
  testing,
}: ProjectOverviewProps) {
  const statsFallback = stats ?? {
    clusters: 0,
    features: 0,
    files: 0,
    connections: 0,
  };
  const statsData = statistics?.status === 'present' ? statistics.data : undefined;
  const statsCounts = {
    clusters: statsData?.counts.clusters ?? statsFallback.clusters,
    features: statsData?.counts.features ?? statsFallback.features,
    files: statsData?.counts.files ?? statsFallback.files,
    connections: statsData?.counts.edges ?? statsFallback.connections,
  };
  const statsUpdatedAt = statsData?.detectedAt ?? statsFallback.updatedAt;
  const statsUpdatedLabel = statsUpdatedAt
    ? formatDate(statsUpdatedAt)
    : getUnavailableLabel(statistics?.status);
  const techStackData = techStack.status === 'present' ? techStack.data : undefined;
  const conventionsData = conventions.status === 'present' ? conventions.data : undefined;
  const structureData = structure?.status === 'present' ? structure.data : undefined;
  const testingData = testing?.status === 'present' ? testing.data : undefined;
  const techEmptyLabel = getEmptyLabel(techStack.status);
  const conventionsEmptyLabel = getEmptyLabel(conventions.status);
  const structureEmptyLabel = getEmptyLabel(structure?.status);
  const testingEmptyLabel = getEmptyLabel(testing?.status);
  const frameworkLabels =
    techStackData?.frameworks
      .filter(
        (framework) =>
          !framework.category || PRIMARY_FRAMEWORK_CATEGORIES.has(framework.category)
      )
      .map((framework) =>
        framework.version ? `${framework.name} ${framework.version}` : framework.name
      ) ?? [];
  const dependencyLabels =
    techStackData?.dependencies?.map((dependency) =>
      dependency.version ? `${dependency.name} ${dependency.version}` : dependency.name
    ) ?? [];
  const languageLabels =
    techStackData?.languages.map((language) => {
      if (typeof language.percentage === 'number') {
        return `${language.name} ${Math.round(language.percentage)}%`;
      }
      return language.name;
    }) ?? [];
  const buildToolLabels = techStackData?.buildTools ?? [];
  const namingFiles = conventionsData?.naming?.files;
  const importStyle = conventionsData?.imports?.style;
  const workspaceType = structureData?.workspace.type;
  const workspaceManager = structureData?.workspace.packageManager;
  const workspacePackages = structureData?.workspace.packages ?? [];
  const testingFrameworks =
    testingData?.frameworks.map((framework) =>
      framework.version ? `${framework.name} ${framework.version}` : framework.name
    ) ?? [];
  const testFileTotal = testingData?.testFiles.total;
  const testFilePatterns = testingData?.testFiles.patterns ?? [];
  const testFileLabel =
    testFileTotal === undefined
      ? getUnavailableLabel(testing?.status)
      : testFileTotal > 0
        ? `${testFileTotal} files`
        : 'Not detected';
  return (
    <div className="p-4 space-y-4">
      <OverviewSection title="Statistics" icon={FileText} defaultOpen>
        <div className="grid grid-cols-2 gap-3 text-sm text-foreground">
          <StatItem label="Clusters" value={statsCounts.clusters} />
          <StatItem label="Features" value={statsCounts.features} />
          <StatItem label="Files" value={statsCounts.files} />
          <StatItem label="Connections" value={statsCounts.connections} />
        </div>
        <div className="text-[11px] text-muted-foreground mt-2">
          Updated {statsUpdatedLabel}
        </div>
      </OverviewSection>
      <OverviewSection title="Tech Stack" icon={Package}>
        <div className="space-y-4">
          <StackSection icon={Package} label="Libraries">
            {renderBadgeList(dependencyLabels, techEmptyLabel)}
          </StackSection>
          <StackSection icon={Package} label="Frameworks">
            {renderBadgeList(frameworkLabels, techEmptyLabel)}
          </StackSection>
          <StackSection icon={Code} label="Languages">
            {renderBadgeList(languageLabels, techEmptyLabel)}
          </StackSection>
          <StackSection icon={Code} label="Build tools">
            {renderBadgeList(buildToolLabels, techEmptyLabel)}
          </StackSection>
        </div>
      </OverviewSection>
      <OverviewSection title="Conventions" icon={Code}>
        <div className="space-y-4 text-sm text-foreground">
          <div className="space-y-3">
            <SectionLabel label="Naming patterns" />
            <div className="space-y-2">
              <KeyValueRow
                label="Components"
                value={namingFiles?.components ?? conventionsEmptyLabel}
              />
              <KeyValueRow label="Utils" value={namingFiles?.utils ?? conventionsEmptyLabel} />
              <KeyValueRow label="Types" value={namingFiles?.types ?? conventionsEmptyLabel} />
            </div>
          </div>
          <div className="space-y-3">
            <SectionLabel label="Import style" />
            <div className="text-sm text-foreground">
              {importStyle ?? conventionsEmptyLabel}
            </div>
          </div>
        </div>
      </OverviewSection>
      <OverviewSection title="File Structure" icon={FolderTree}>
        <div className="space-y-4 text-sm text-foreground">
          <KeyValueRow label="Workspace" value={workspaceType ?? structureEmptyLabel} />
          <KeyValueRow
            label="Package manager"
            value={workspaceManager ?? structureEmptyLabel}
          />
          <div className="space-y-3">
            <SectionLabel label="Packages" />
            {renderBadgeList(workspacePackages, structureEmptyLabel)}
          </div>
        </div>
      </OverviewSection>
      <OverviewSection title="Testing" icon={TestTube2}>
        <div className="space-y-4 text-sm text-foreground">
          <div className="space-y-3">
            <SectionLabel label="Frameworks" />
            {renderBadgeList(testingFrameworks, testingEmptyLabel)}
          </div>
          <KeyValueRow label="Test files" value={testFileLabel} />
          <div className="space-y-3">
            <SectionLabel label="Patterns" />
            {renderBadgeList(testFilePatterns, testingEmptyLabel)}
          </div>
        </div>
      </OverviewSection>
    </div>
  );
}
function OverviewSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: typeof Package;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icon size={16} className="text-muted-foreground" />
              {title}
            </div>
            <ChevronDown
              size={16}
              className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-4 pb-3 pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
function StackSection({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Package;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <SectionLabel label={label} icon={Icon} />
      {children}
    </div>
  );
}
function SectionLabel({ label, icon: Icon }: { label: string; icon?: typeof Package }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {Icon ? <Icon size={14} /> : null}
      {label}
    </div>
  );
}

function renderBadgeList(items: string[], fallback: string) {
  if (items.length === 0) {
    return <div className="text-xs text-muted-foreground/80">{fallback}</div>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <Badge key={`${item}-${index}`} variant="secondary" className="text-xs">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function KeyValueRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function getUnavailableLabel(status?: ContextStatus) {
  if (status === 'invalid') {
    return 'Invalid data';
  }
  return 'Not available';
}

function getEmptyLabel(status?: ContextStatus) {
  if (status === 'present') {
    return 'Not detected';
  }
  return getUnavailableLabel(status);
}
