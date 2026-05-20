import { useT } from '@atv-design/i18n';
import { useState } from 'react';

interface TypographySpecimenProps {
  value: string;
  index: number;
  onEdit: (index: number, newValue: string) => void;
  onRemove: (index: number) => void;
}

export function TypographySpecimen({ value, index, onEdit, onRemove }: TypographySpecimenProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    if (draft.trim() && draft !== value) onEdit(index, draft.trim());
    setEditing(false);
  }

  return (
    <div className="group flex items-center justify-between gap-[var(--space-3)] py-[var(--space-3)] border-b border-[var(--color-border-subtle)] last:border-none">
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
          className="flex-1 text-[var(--text-sm)] border border-[var(--color-border)] rounded px-[var(--space-2)] py-[var(--space-1)] bg-[var(--color-background)] text-[var(--color-text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-focus)]"
        />
      ) : (
        <div className="flex-1 flex flex-col gap-[var(--space-1)] min-w-0">
          <span
            className="text-[var(--text-md)] text-[var(--color-text-primary)] truncate leading-[var(--leading-snug)]"
            style={{ fontFamily: value }}
          >
            The quick brown fox jumps
          </span>
          <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] font-mono truncate">
            {value}
          </span>
        </div>
      )}
      <div className="flex gap-[var(--space-1)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setDraft(value);
          }}
          className="text-[var(--text-xs)] px-[var(--space-2)] py-[var(--space-1)] rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
          title={t('hub.designSystems.tokens.edit')}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-[var(--text-xs)] px-[var(--space-2)] py-[var(--space-1)] rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
          title={t('hub.designSystems.tokens.remove')}
        >
          ×
        </button>
      </div>
    </div>
  );
}
