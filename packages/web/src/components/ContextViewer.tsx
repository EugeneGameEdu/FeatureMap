import { useState } from 'react';
import { Check, Clipboard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { ContextData, ContextFile } from '@/lib/types';

type ContextKey = keyof ContextData;

const CONTEXT_SECTIONS: Array<{ key: ContextKey; label: string; filename: string }> = [
  { key: 'techStack', label: 'Tech Stack', filename: 'tech-stack.yaml' },
  { key: 'conventions', label: 'Conventions', filename: 'conventions.yaml' },
  { key: 'decisions', label: 'Decisions', filename: 'decisions.yaml' },
  { key: 'constraints', label: 'Constraints', filename: 'constraints.yaml' },
  { key: 'overview', label: 'Overview', filename: 'overview.yaml' },
  { key: 'designSystem', label: 'Design System', filename: 'design-system.yaml' },
];

export function ContextViewer({ context }: { context: ContextData }) {
  const [copiedKey, setCopiedKey] = useState<ContextKey | null>(null);

  const handleCopy = async (key: ContextKey, raw: string | undefined) => {
    if (!raw) {
      return;
    }

    try {
      await navigator.clipboard.writeText(raw);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1500);
    } catch {
      setCopiedKey(null);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          Context
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Project Context</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-4">
          <ScrollArea className="h-[calc(100vh-140px)] pr-4">
            <div className="flex flex-col gap-4">
              {CONTEXT_SECTIONS.map((section) => (
                <ContextSection
                  key={section.key}
                  section={section}
                  file={context[section.key]}
                  copied={copiedKey === section.key}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ContextSection({
  section,
  file,
  copied,
  onCopy,
}: {
  section: { key: ContextKey; label: string; filename: string };
  file: ContextFile<unknown>;
  copied: boolean;
  onCopy: (key: ContextKey, raw: string | undefined) => void;
}) {
  const statusLabel = file.status === 'present' ? 'present' : file.status;
  const badgeVariant =
    file.status === 'present' ? 'secondary' : file.status === 'missing' ? 'outline' : 'destructive';

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-800">{section.label}</div>
          <div className="text-xs text-gray-500">{section.filename}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={badgeVariant}>{statusLabel}</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy(section.key, file.raw)}
            disabled={!file.raw}
          >
            {copied ? <Check size={14} /> : <Clipboard size={14} />}
          </Button>
        </div>
      </div>

      {file.status === 'missing' && (
        <div className="mt-3 text-sm text-gray-500">Missing file.</div>
      )}

      {file.status === 'invalid' && (
        <div className="mt-3 text-sm text-red-600">{file.error ?? 'Invalid YAML.'}</div>
      )}

      {file.raw && (
        <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap">
          {file.raw}
        </pre>
      )}
    </div>
  );
}
