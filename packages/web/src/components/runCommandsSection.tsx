import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Check, ChevronRight, Clipboard } from 'lucide-react';
import type { RunCommands } from '@/lib/contextTypes';
import { usePersistentBoolean } from '@/components/usePersistentBoolean';

type CommandEntry = NonNullable<RunCommands['commands']>[string];
type RunCommandsContentProps = {
  commands?: RunCommands['commands'];
  subprojects?: RunCommands['subprojects'];
  emptyLabel: string;
};

export function RunCommandsContent({
  commands,
  subprojects,
  emptyLabel,
}: RunCommandsContentProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1500);
    } catch {
      // Silently fail
    }
  };

  const commandEntries = commands ? Object.entries(commands) : [];
  const subprojectEntries = subprojects ? Object.entries(subprojects) : [];

  if (commandEntries.length === 0 && subprojectEntries.length === 0) {
    return <div className="text-xs text-muted-foreground/80">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-3 text-sm text-foreground">
      {commandEntries.length > 0 && (
        <RunCommandsGroup
          storageKey="root"
          title="Root"
          subtitle={subprojectEntries.length > 0 ? 'Project root' : undefined}
          commands={commandEntries}
          copiedKey={copiedKey}
          onCopy={handleCopy}
        />
      )}

      {subprojectEntries.map(([packageName, pkg]) => (
        <RunCommandsGroup
          key={packageName}
          storageKey={packageName}
          title={formatPackageLabel(packageName)}
          subtitle={pkg.path}
          badgeLabel={packageName.startsWith('@') ? packageName : undefined}
          commands={Object.entries(pkg.commands)}
          copiedKey={copiedKey}
          onCopy={handleCopy}
        />
      ))}
    </div>
  );
}

function RunCommandsGroup({
  storageKey,
  title,
  subtitle,
  badgeLabel,
  commands,
  copiedKey,
  onCopy,
}: {
  storageKey: string;
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  commands: Array<[string, CommandEntry]>;
  copiedKey: string | null;
  onCopy: (key: string, command: string) => void;
}) {
  const [expanded, setExpanded] = usePersistentBoolean(
    `run-commands:${storageKey}`,
    false
  );

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-start gap-2 text-left text-sm font-semibold text-foreground hover:text-foreground"
        >
          <ChevronRight
            size={16}
            className={`mt-0.5 text-muted-foreground transition-transform ${
              expanded ? 'rotate-90' : ''
            }`}
          />
          <div className="flex flex-1 items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span>{title}</span>
                {badgeLabel ? (
                  <Badge
                    variant="outline"
                    className="px-1 py-0 text-[10px] font-mono text-muted-foreground border-muted-foreground/40"
                  >
                    {badgeLabel}
                  </Badge>
                ) : null}
              </div>
              {subtitle ? (
                <div className="text-xs font-normal text-muted-foreground">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1.5 pl-6 pt-2">
          {commands.map(([name, entry]) => (
            <CommandRow
              key={`${storageKey}:${name}`}
              name={name}
              command={entry.command}
              source={entry.source}
              copied={copiedKey === `${storageKey}:${name}`}
              onCopy={() => onCopy(`${storageKey}:${name}`, entry.command)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CommandRow({
  name,
  command,
  source,
  copied,
  onCopy,
}: {
  name: string;
  command: string;
  source: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="group flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5 hover:bg-muted">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-medium text-primary">{name}</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1 py-0 border-muted-foreground/40 text-muted-foreground"
          >
            {source}
          </Badge>
        </div>
        <div
          className="mt-1 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-words leading-5"
          title={command}
        >
          {command}
        </div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="flex items-center gap-1 rounded p-1 text-muted-foreground/80 transition-colors hover:text-foreground"
        title={copied ? 'Copied' : 'Copy command'}
        aria-label={copied ? 'Copied' : 'Copy command'}
      >
        {copied ? (
          <Check size={14} className="text-emerald-500" />
        ) : (
          <Clipboard size={14} />
        )}
        <span className="sr-only">{copied ? 'Copied' : 'Copy command'}</span>
      </button>
    </div>
  );
}

function formatPackageLabel(packageName: string) {
  const rawName = packageName.startsWith('@')
    ? packageName.split('/')[1] ?? packageName
    : packageName;
  const words = rawName.split(/[-_]+/).filter(Boolean);
  return words.map(formatPackageWord).join(' ');
}

function formatPackageWord(word: string) {
  const normalized = word.toLowerCase();
  const overrides: Record<string, string> = {
    api: 'API',
    cli: 'CLI',
    mcp: 'MCP',
    ui: 'UI',
  };
  if (overrides[normalized]) {
    return overrides[normalized];
  }
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}
