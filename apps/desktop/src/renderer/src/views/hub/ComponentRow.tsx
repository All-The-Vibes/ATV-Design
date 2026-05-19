import { useT } from '@atv-design/i18n';
import { useState } from 'react';

interface ComponentRowProps {
  name: string;
  rule: string;
  index: number;
  onEditName: (i: number, v: string) => void;
  onEditRule: (i: number, v: string) => void;
  onRemove: (i: number) => void;
}

/**
 * Inline-editable card for a single component rule in the Design Systems tab.
 * Name uses a single-line input; rule uses an auto-resizing 2-row textarea.
 */
export function ComponentRow({
  name,
  rule,
  index,
  onEditName,
  onEditRule,
  onRemove,
}: ComponentRowProps) {
  const t = useT();
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [editingRule, setEditingRule] = useState(false);
  const [draftRule, setDraftRule] = useState(rule);

  function commitName() {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== name) onEditName(index, trimmed);
    setEditingName(false);
  }

  function commitRule() {
    const trimmed = draftRule.trim();
    if (trimmed && trimmed !== rule) onEditRule(index, trimmed);
    setEditingRule(false);
  }

  return (
    <div className="group rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] space-y-[var(--space-1)]">
      {/* Name row */}
      <div className="flex items-center gap-[var(--space-2)]">
        {editingName ? (
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setEditingName(false);
            }}
            onBlur={commitName}
            placeholder={t('hub.designSystems.components.namePlaceholder')}
            className="flex-1 text-[var(--text-xs)] font-semibold border border-[var(--color-border)] rounded px-[var(--space-2)] py-[var(--space-1)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-focus)]"
          />
        ) : (
          <span
            className="flex-1 text-[var(--text-xs)] font-semibold text-[var(--color-text-primary)] cursor-text"
            onClick={() => {
              setEditingName(true);
              setDraftName(name);
            }}
          >
            {name}
          </span>
        )}
        <div className="flex gap-[var(--space-1)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {!editingName && (
            <button
              type="button"
              onClick={() => {
                setEditingName(true);
                setDraftName(name);
              }}
              className="text-[var(--text-xs)] px-[var(--space-1_5)] py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
              title={t('hub.designSystems.tokens.edit')}
            >
              Edit
            </button>
          )}
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

      {/* Rule textarea */}
      {editingRule ? (
        <textarea
          value={draftRule}
          onChange={(e) => setDraftRule(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditingRule(false);
          }}
          onBlur={commitRule}
          rows={2}
          placeholder={t('hub.designSystems.components.rulePlaceholder')}
          className="w-full text-[var(--text-xs)] border border-[var(--color-border)] rounded px-[var(--space-2)] py-[var(--space-1)] bg-[var(--color-background)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-focus)] leading-[var(--leading-body)]"
        />
      ) : (
        <p
          className="text-[var(--text-xs)] text-[var(--color-text-secondary)] leading-[var(--leading-body)] cursor-text m-0"
          onClick={() => {
            setEditingRule(true);
            setDraftRule(rule);
          }}
        >
          {rule}
        </p>
      )}
    </div>
  );
}
