import { useT } from '@atv-design/i18n';
import { useRef, useState } from 'react';

interface TokenSwatchProps {
  value: string;
  index: number;
  onEdit: (index: number, newValue: string) => void;
  onRemove: (index: number) => void;
}

/** Determines if a CSS color value is a plain hex color editable via <input type="color">. */
function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(value.trim());
}

export function TokenSwatch({ value, index, onEdit, onRemove }: TokenSwatchProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    if (draft.trim() && draft !== value) onEdit(index, draft.trim());
    setEditing(false);
  }

  return (
    <div className="group relative flex flex-col items-start gap-[var(--space-2)] w-16">
      <button
        type="button"
        title={t('hub.designSystems.tokens.edit')}
        onClick={() => {
          setEditing(true);
          setDraft(value);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="w-16 h-16 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] flex-shrink-0 transition-all hover:shadow-[var(--shadow-soft)] hover:-translate-y-px cursor-pointer"
        style={{ background: value }}
        aria-label={`${t('hub.designSystems.tokens.edit')}: ${value}`}
      />
      <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)] font-mono truncate max-w-full leading-none">
        {value}
      </span>

      {/* Remove button */}
      <button
        type="button"
        title={t('hub.designSystems.tokens.remove')}
        onClick={() => onRemove(index)}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hidden group-hover:flex items-center justify-center text-[var(--text-xs)] hover:text-[var(--color-text-primary)] shadow-[var(--shadow-soft)] transition-colors"
        aria-label={`${t('hub.designSystems.tokens.remove')}: ${value}`}
      >
        ×
      </button>

      {/* Edit popover */}
      {editing && (
        <div className="absolute top-[72px] left-0 z-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-[var(--space-2)] shadow-[var(--shadow-card)] flex flex-col gap-[var(--space-1)] min-w-[180px]">
          {isHexColor(value) ? (
            <input
              ref={inputRef}
              type="color"
              value={draft.trim()}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full h-8 cursor-pointer rounded border border-[var(--color-border)]"
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full text-[var(--text-xs)] font-mono border border-[var(--color-border)] rounded px-[var(--space-1)] py-[var(--space-1)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-focus)]"
            />
          )}
          <div className="flex gap-[var(--space-1)] justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[var(--text-xs)] px-[var(--space-2)] py-[var(--space-1)] rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
            >
              {/* Cancel */}✕
            </button>
            <button
              type="button"
              onClick={commit}
              className="text-[var(--text-xs)] px-[var(--space-2)] py-[var(--space-1)] rounded bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90 transition-opacity"
            >
              ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
