import { useEffect, useMemo, useState } from 'react';
import { Link2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UiComment } from '@/lib/commentsMode';

interface CommentEditorProps {
  comment: UiComment;
  isSaving: boolean;
  saveError: string | null;
  linkMode: boolean;
  onChange: (updates: Partial<UiComment>) => void;
  onSave: () => void;
  onCancel: () => void;
  onToggleLinkMode: () => void;
}

export function CommentEditor({
  comment,
  isSaving,
  saveError,
  linkMode,
  onChange,
  onSave,
  onCancel,
  onToggleLinkMode,
}: CommentEditorProps) {
  const [tagsValue, setTagsValue] = useState(comment.tags?.join(', ') ?? '');

  useEffect(() => {
    setTagsValue(comment.tags?.join(', ') ?? '');
  }, [comment.id, comment.tags]);

  const canSave = useMemo(() => {
    return comment.links.length > 0 && comment.content.trim().length > 0;
  }, [comment.content, comment.links.length]);

  return (
    <div className="absolute right-4 top-24 z-20 w-[320px] rounded-xl border border-gray-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="text-sm font-semibold text-gray-800">
          {comment.status === 'draft' ? 'New comment' : 'Edit comment'}
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close editor">
          <X size={16} />
        </Button>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Content</label>
          <textarea
            className="mt-1 w-full min-h-[120px] rounded-md border border-gray-200 px-2 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-300"
            value={comment.content}
            placeholder="Write your comment..."
            onChange={(event) => onChange({ content: event.target.value, isDirty: true })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Tags (optional)</label>
          <input
            className="mt-1 w-full h-8 rounded-md border border-gray-200 px-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-300"
            value={tagsValue}
            placeholder="auth, todo"
            onChange={(event) => {
              const value = event.target.value;
              setTagsValue(value);
              const tags = value
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
              onChange({ tags, isDirty: true });
            }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Priority (optional)</label>
          <select
            className="mt-1 w-full h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700"
            value={comment.priority ?? ''}
            onChange={(event) =>
              onChange({
                priority: event.target.value
                  ? (event.target.value as UiComment['priority'])
                  : undefined,
                isDirty: true,
              })
            }
          >
            <option value="">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex items-center justify-between rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <span className="flex items-center gap-1">
            <Link2 size={12} />
            Links: {comment.links.length}
          </span>
          <Button
            variant={linkMode ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onToggleLinkMode}
          >
            {linkMode ? 'Linking' : 'Link'}
          </Button>
        </div>
        {linkMode && (
          <div className="text-[11px] text-amber-600">
            Link mode active. Click feature/cluster nodes to toggle links.
          </div>
        )}
        {saveError && <div className="text-xs text-red-600">{saveError}</div>}
      </div>
      <div className="flex items-center justify-between border-t px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onSave}
          disabled={!canSave || isSaving}
        >
          <Save size={14} className="mr-1" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      {!canSave && (
        <div className="px-4 pb-3 text-[11px] text-gray-400">
          Add content and at least one link to save.
        </div>
      )}
    </div>
  );
}
