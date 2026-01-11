import { useEffect, useState } from 'react';
import type { ZodTypeAny } from 'zod';
import { Button } from '@/components/ui/button';
import type { ContextFile } from '@/lib/contextTypes';
import { ContextApiError } from '@/lib/useContextApi';
import { parseYamlWithSchema } from '@/lib/yamlParsing';

interface ContextEditorProps {
  filename: string;
  file: ContextFile<unknown>;
  schema: ZodTypeAny;
  token: string;
  onSave: (file: string, data: unknown) => Promise<unknown>;
  onSaved: () => void;
}

export function ContextEditor({
  filename,
  file,
  schema,
  token,
  onSave,
  onSaved,
}: ContextEditorProps) {
  const [draft, setDraft] = useState(file.raw ?? '');
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setDraft(file.raw ?? '');
    }
  }, [file.raw, dirty]);

  useEffect(() => {
    setValidationError(null);
    setSaveError(null);
  }, [filename]);

  const handleChange = (value: string) => {
    setDraft(value);
    setDirty(true);
    setValidationError(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    setValidationError(null);
    setSaveError(null);

    if (!token) {
      setSaveError('Invalid or missing token.');
      return;
    }

    let parsed: unknown;
    try {
      parsed = parseYamlWithSchema(draft, schema, `context/${filename}`);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Invalid YAML.');
      return;
    }

    setSaving(true);
    try {
      await onSave(filename, parsed);
      setDirty(false);
      onSaved();
    } catch (error) {
      if (error instanceof ContextApiError) {
        setSaveError(error.message);
      } else {
        setSaveError('Serve not running / API unavailable');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <textarea
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        className="min-h-[220px] w-full rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Paste YAML here..."
      />
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {token ? 'Token set' : 'Token not set'}
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      {validationError && (
        <div className="text-xs text-destructive" role="alert">
          {validationError}
        </div>
      )}
      {saveError && (
        <div className="text-xs text-destructive" role="alert">
          {saveError}
        </div>
      )}
    </div>
  );
}
