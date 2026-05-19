import { useT } from '@atv-design/i18n';
import { useState } from 'react';

interface SpacingChipProps {
  value: string;
  index: number;
  onEdit: (index: number, newValue: string) => void;
  onRemove: (index: number) => void;
}

/** Parse a CSS length to a pixel width for the visual bar (capped at 128px). */
function toBarWidth(value: string): number {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return 8;
  if (/rem$/i.test(value)) return Math.min(n * 16, 128);
  return Math.min(n, 128);
}

export function SpacingChip({ value, index, onEdit, onRemove }: SpacingChipProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const width = toBarWidth(value);

  function commit() {
    if (draft.trim() && draft !== value) onEdit(index, draft.trim());
    setEditing(false);
  }

  return (
    <div className="group flex items-center gap-[var(--space-3)] py-[var(--space-1)]">
      <div
        className="h-4 rounded-[var(--radius-sm)] bg-[var(--color-accent-soft)] border border-[var(--color-border)] flex-shrink-0"
        style={{ width }}
      />
      {editing ? (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={commit}
          className="w-24 text-[var(--text-xs)] font-mono border border-[var(--color-border)] rounded px-[var(--space-1)] py-[var(--space-1)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-focus)]"
        />
      ) : (
        <span className="text-[var(--text-xs)] font-mono text-[var(--color-text-secondary)]">
          {value}
        </span>
      )}
      <div className="flex gap-[var(--space-1)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setDraft(value);
          }}
          className="text-[var(--text-xs)] px-[var(--space-1_5)] py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
          title={t('hub.designSystems.tokens.edit')}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-[var(--text-xs)] px-[var(--space-1_5)] py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
          title={t('hub.designSystems.tokens.remove')}
        >
          ×
        </button>
      </div>
    </div>
  );
}
