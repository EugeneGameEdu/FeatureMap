import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Code, FileCode, GitBranch, Layers, Package } from 'lucide-react';
import type { ContextFile, Conventions, ContextStatus, TechStack } from '@/lib/contextTypes';
import { formatDate } from '@/lib/loadFeatureMap';

export type ProjectStats = {
  clusters: number;
  features: number;
  files: number;
  connections: number;
  updatedAt?: string;
};

interface ProjectOverviewProps {
  stats: ProjectStats;
  techStack: ContextFile<TechStack>;
  conventions: ContextFile<Conventions>;
}

export function ProjectOverview({ stats, techStack, conventions }: ProjectOverviewProps) {
  const techStackData = techStack.status === 'present' ? techStack.data : undefined;
  const conventionsData = conventions.status === 'present' ? conventions.data : undefined;
  const techFallback = getFallbackLabel(techStack.status);
  const conventionsFallback = getFallbackLabel(conventions.status);
  const updatedLabel = stats.updatedAt ? formatDate(stats.updatedAt) : 'Not detected';

  const frameworkLabels =
    techStackData?.frameworks.map((framework) =>
      framework.version ? `${framework.name} ${framework.version}` : framework.name
    ) ?? [];
  const languageLabels =
    techStackData?.languages.map((language) => {
      if (typeof language.percentage === 'number') {
        return `${language.name} ${Math.round(language.percentage)}%`;
      }
      return language.name;
    }) ?? [];
  const buildToolLabels = techStackData?.buildTools ?? [];
  const testingLabels = techStackData?.testing?.frameworks ?? [];

  const namingFiles = conventionsData?.naming?.files;
  const fileOrganization = conventionsData?.fileOrganization;

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers size={16} />
            Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <div className="flex flex-wrap gap-3">
            <span>{stats.clusters} clusters</span>
            <span>{stats.features} features</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <span>{stats.files} files</span>
            <span>{stats.connections} connections</span>
          </div>
          <div className="text-xs text-gray-500">Updated {updatedLabel}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package size={16} />
            Tech Stack
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-700">
          <StackSection icon={Package} label="Frameworks">
            {renderBadgeList(frameworkLabels, techFallback)}
          </StackSection>
          <StackSection icon={Code} label="Languages">
            {renderBadgeList(languageLabels, techFallback)}
          </StackSection>
          <StackSection icon={GitBranch} label="Build tools">
            {renderBadgeList(buildToolLabels, techFallback)}
          </StackSection>
          <StackSection icon={FileCode} label="Testing">
            {renderBadgeList(testingLabels, techFallback)}
          </StackSection>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileCode size={16} />
            Conventions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Naming patterns
            </div>
            <div className="space-y-1">
              <KeyValue label="Components" value={namingFiles?.components ?? conventionsFallback} />
              <KeyValue label="Utils" value={namingFiles?.utils ?? conventionsFallback} />
              <KeyValue label="Types" value={namingFiles?.types ?? conventionsFallback} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Import style
            </div>
            <div className="text-sm text-gray-700">
              {conventionsData?.imports?.style ?? conventionsFallback}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              File structure
            </div>
            {fileOrganization?.pattern ? (
              <div className="text-sm text-gray-700">
                <div>{fileOrganization.pattern}</div>
                {fileOrganization.description && (
                  <div className="text-xs text-gray-500">{fileOrganization.description}</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-700">{conventionsFallback}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
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
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Icon size={14} />
        {label}
      </div>
      {children}
    </div>
  );
}

function renderBadgeList(items: string[], fallback: string) {
  if (items.length === 0) {
    return <div className="text-xs text-gray-500">{fallback}</div>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <Badge key={`${item}-${index}`} variant="secondary" className="text-xs">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
  );
}

function getFallbackLabel(status: ContextStatus) {
  return status === 'invalid' ? 'Invalid data' : 'Not detected';
}
