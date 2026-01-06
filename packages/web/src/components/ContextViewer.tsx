import { useEffect, useState } from 'react';
import { Check, Clipboard } from 'lucide-react';
import type { ZodTypeAny } from 'zod';
import { ContextEditor } from '@/components/ContextEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  ConstraintsSchema,
  DecisionsSchema,
  DesignSystemSchema,
  type ContextData,
  type ContextFile,
  OverviewSchema,
} from '@/lib/contextTypes';
import { useContextApi } from '@/lib/useContextApi';

type ContextKey = keyof ContextData;

type ContextSectionConfig = {
  key: ContextKey;
  label: string;
  filename: string;
  editable: boolean;
  schema?: ZodTypeAny;
};

const CONTEXT_SECTIONS: ContextSectionConfig[] = [
  { key: 'techStack', label: 'Tech Stack', filename: 'tech-stack.yaml', editable: false },
  { key: 'conventions', label: 'Conventions', filename: 'conventions.yaml', editable: false },
  {
    key: 'decisions',
    label: 'Decisions',
    filename: 'decisions.yaml',
    editable: true,
    schema: DecisionsSchema,
  },
  {
    key: 'constraints',
    label: 'Constraints',
    filename: 'constraints.yaml',
    editable: true,
    schema: ConstraintsSchema,
  },
  {
    key: 'overview',
    label: 'Overview',
    filename: 'overview.yaml',
    editable: true,
    schema: OverviewSchema,
  },
  {
    key: 'designSystem',
    label: 'Design System',
    filename: 'design-system.yaml',
    editable: true,
    schema: DesignSystemSchema,
  },
];

export function ContextViewer({
  context,
  onRefresh,
}: {
  context: ContextData;
  onRefresh: () => void;
}) {
  const [copiedKey, setCopiedKey] = useState<ContextKey | null>(null);
  const [editingKey, setEditingKey] = useState<ContextKey | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { token, setToken, updateContextFile } = useContextApi();

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToastMessage(null);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

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

  const handleSaved = () => {
    setToastMessage('Saved');
    onRefresh();
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
        {toastMessage && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {toastMessage}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Session token</div>
              <Badge variant={token ? 'secondary' : 'outline'}>
                {token ? 'Token set' : 'Token not set'}
              </Badge>
            </div>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste session token"
              className="mt-2 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2 text-xs text-gray-500">
              Paste the token from the serve console to enable saving.
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-140px)] pr-4">
            <div className="flex flex-col gap-4">
              {CONTEXT_SECTIONS.map((section) => (
                <ContextSection
                  key={section.key}
                  section={section}
                  file={context[section.key]}
                  copied={copiedKey === section.key}
                  onCopy={handleCopy}
                  editable={section.editable}
                  isEditing={editingKey === section.key}
                  onToggleEdit={() =>
                    setEditingKey((current) => (current === section.key ? null : section.key))
                  }
                  token={token}
                  schema={section.schema}
                  onSave={updateContextFile}
                  onSaved={handleSaved}
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
  editable,
  isEditing,
  onToggleEdit,
  token,
  schema,
  onSave,
  onSaved,
}: {
  section: ContextSectionConfig;
  file: ContextFile<unknown>;
  copied: boolean;
  onCopy: (key: ContextKey, raw: string | undefined) => void;
  editable: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
  token: string;
  schema?: ZodTypeAny;
  onSave: (file: string, data: unknown) => Promise<unknown>;
  onSaved: () => void;
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
          {editable && (
            <Button variant="ghost" size="sm" onClick={onToggleEdit}>
              {isEditing ? 'Close' : 'Edit'}
            </Button>
          )}
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

      {isEditing && editable && schema && (
        <ContextEditor
          key={section.filename}
          filename={section.filename}
          file={file}
          schema={schema}
          token={token}
          onSave={onSave}
          onSaved={onSaved}
        />
      )}

      {!isEditing && file.raw && (
        <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap">
          {file.raw}
        </pre>
      )}
    </div>
  );
}
