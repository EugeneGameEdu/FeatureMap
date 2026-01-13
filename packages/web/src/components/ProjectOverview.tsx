import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Code, FolderTree, Package, TestTube2, ChevronDown } from 'lucide-react';
import type {
  ContextFile,
  Conventions,
  ContextStatus,
  Structure,
  TechStack,
  Testing,
} from '@/lib/contextTypes';
import { buildTechStackGroups } from '@/components/projectOverviewHelpers';
import { usePersistentBoolean } from '@/components/usePersistentBoolean';

export type ProjectStats = {
  clusters: number;
  features: number;
  files: number;
  connections: number;
  updatedAt?: string;
};
interface ProjectOverviewProps {
  techStack: ContextFile<TechStack>;
  conventions: ContextFile<Conventions>;
  structure?: ContextFile<Structure>;
  testing?: ContextFile<Testing>;
}
export function ProjectOverview({
  techStack,
  conventions,
  structure,
  testing,
}: ProjectOverviewProps) {
  const techStackData = techStack.status === 'present' ? techStack.data : undefined;
  const conventionsData = conventions.status === 'present' ? conventions.data : undefined;
  const structureData = structure?.status === 'present' ? structure.data : undefined;
  const testingData = testing?.status === 'present' ? testing.data : undefined;
  const techEmptyLabel = getEmptyLabel(techStack.status);
  const conventionsEmptyLabel = getEmptyLabel(conventions.status);
  const structureEmptyLabel = getEmptyLabel(structure?.status);
  const testingEmptyLabel = getEmptyLabel(testing?.status);
  const techStackGroups = buildTechStackGroups(techStackData);
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
    <div className="p-4 space-y-2">
      <OverviewSection id="tech-stack" title="Tech Stack" icon={Package}>
        <div className="space-y-4 pl-6 text-sm text-foreground">
          <div className="space-y-2">
            <SectionLabel label="Libraries" icon={Package} />
            <div className="space-y-3 pl-4">
              {techStackGroups.length === 0 ? (
                <div className="text-xs text-muted-foreground/80">{techEmptyLabel}</div>
              ) : (
                techStackGroups.map((group) => (
                  <div key={group.category} className="space-y-1.5">
                    <div className="text-xs font-normal uppercase tracking-wide text-[hsl(var(--accent-subheader))]">
                      {group.category} ({group.count})
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-3">
                      {group.items.map((item) => (
                        <Badge
                          key={`${group.category}-${item.name}`}
                          variant="secondary"
                          className="text-sm font-mono"
                        >
                          {item.name}
                          {item.version ? (
                            <span className="ml-1 text-xs font-sans text-muted-foreground">
                              {item.version}
                            </span>
                          ) : null}
                          {item.detail ? (
                            <span className="ml-1 text-xs font-sans text-muted-foreground">
                              {item.detail}
                            </span>
                          ) : null}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="space-y-2">
            <SectionLabel label="Languages" icon={Code} />
            <div className="pl-4">{renderBadgeList(languageLabels, techEmptyLabel)}</div>
          </div>
          <div className="space-y-2">
            <SectionLabel label="Build tools" icon={Code} />
            <div className="pl-4">{renderBadgeList(buildToolLabels, techEmptyLabel)}</div>
          </div>
        </div>
      </OverviewSection>

      <OverviewSection id="file-structure" title="File Structure" icon={FolderTree}>
        <div className="space-y-2 text-sm text-foreground">
          <KeyValueRow label="Workspace" value={workspaceType ?? structureEmptyLabel} />
          <KeyValueRow
            label="Package manager"
            value={workspaceManager ?? structureEmptyLabel}
          />
          <div className="space-y-2 pt-1">
            <SectionLabel label="Packages" />
            {renderBadgeList(workspacePackages, structureEmptyLabel)}
          </div>
        </div>
      </OverviewSection>

      <OverviewSection id="conventions" title="Conventions" icon={Code}>
        <div className="space-y-3 text-sm text-foreground">
          <div className="space-y-2">
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
          <div className="space-y-2">
            <SectionLabel label="Import style" />
            <div className="text-sm text-foreground">
              {importStyle ?? conventionsEmptyLabel}
            </div>
          </div>
        </div>
      </OverviewSection>

      <OverviewSection id="testing" title="Testing" icon={TestTube2}>
        <div className="space-y-3 text-sm text-foreground">
          <div className="space-y-2">
            <SectionLabel label="Frameworks" />
            {renderBadgeList(testingFrameworks, testingEmptyLabel)}
          </div>
          <KeyValueRow label="Test files" value={testFileLabel} />
          <div className="space-y-2">
            <SectionLabel label="Patterns" />
            {renderBadgeList(testFilePatterns, testingEmptyLabel)}
          </div>
        </div>
      </OverviewSection>
    </div>
  );
}
function OverviewSection({
  id,
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  id: string;
  title: string;
  icon: typeof Package;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = usePersistentBoolean(`project-overview:${id}`, defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
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
          <CardContent className="px-4 pb-3 pt-2">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
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

