import { useT } from '@atv-design/i18n';
import type { DesignSystemTokenPatch, StoredDesignComponent } from '@atv-design/shared';
import { useState } from 'react';
import { useCodesignStore, useEffectiveDesignSystem } from '../../store';
import { ComponentRow } from './ComponentRow';
import { ImportDesignSystemMenu } from './ImportDesignSystemMenu';
import { SpacingChip } from './SpacingChip';
import { TokenSwatch } from './TokenSwatch';
import { TypographySpecimen } from './TypographySpecimen';

// ── Generic inline-editable token list (radius, shadows, spacing) ─────────────

interface SimpleTokenRowProps {
  value: string;
  index: number;
  onEdit: (i: number, v: string) => void;
  onRemove: (i: number) => void;
  previewStyle?: React.CSSProperties;
  previewClass?: string;
}

function SimpleTokenRow({
  value,
  index,
  onEdit,
  onRemove,
  previewStyle,
  previewClass,
}: SimpleTokenRowProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    if (draft.trim() && draft !== value) onEdit(index, draft.trim());
    setEditing(false);
  }

  return (
    <div className="group flex items-center gap-[var(--space-3)] py-[var(--space-1)]">
      {previewStyle !== undefined || previewClass !== undefined ? (
        <div
          className={`w-8 h-8 border border-[var(--color-border)] flex-shrink-0 ${previewClass ?? ''}`}
          style={previewStyle}
        />
      ) : null}
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
          className="flex-1 text-[var(--text-xs)] font-mono border border-[var(--color-border)] rounded px-[var(--space-2)] py-[var(--space-1)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-focus)]"
        />
      ) : (
        <span className="flex-1 text-[var(--text-xs)] font-mono text-[var(--color-text-secondary)] break-all">
          {value}
        </span>
      )}
      <div className="flex gap-[var(--space-1)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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

// ── Token section panel ───────────────────────────────────────────────────────

interface TokenPanelProps {
  title: string;
  children: React.ReactNode;
  onAdd: () => void;
  addLabel: string;
}

function TokenPanel({ title, children, onAdd, addLabel }: TokenPanelProps) {
  return (
    <section className="rounded-[var(--radius-lg)] bg-[var(--color-accent-tint)] p-[var(--space-5)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between mb-[var(--space-4)]">
        <h3
          className="text-[var(--text-md)] font-medium text-[var(--color-text-primary)] m-0 tracking-[var(--tracking-heading)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="text-[var(--text-xs)] px-[var(--space-2_5)] py-[var(--space-1)] rounded-full border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          + {addLabel}
        </button>
      </div>
      <div>{children}</div>
    </section>
  );
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({
  kind,
  value,
  displayName,
}: { kind: string; value?: string | undefined; displayName?: string | undefined }) {
  const t = useT();
  if (kind === 'builtIn') {
    return (
      <span
        data-testid="ds-source-badge"
        className="inline-flex items-center text-[var(--text-xs)] font-medium px-[var(--space-2)] py-0.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-border)]"
      >
        {t('hub.designSystems.source.builtIn')}
      </span>
    );
  }
  if (kind === 'url') {
    let host = value ?? '';
    try {
      host = new URL(value ?? '').hostname;
    } catch {
      /* keep raw */
    }
    return (
      <span
        data-testid="ds-source-badge"
        className="inline-flex items-center text-[var(--text-xs)] font-medium px-[var(--space-2)] py-0.5 rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
      >
        {t('hub.designSystems.source.url', { host })}
      </span>
    );
  }
  // folder / files / unknown
  const name = displayName ?? value ?? 'folder';
  return (
    <span
      data-testid="ds-source-badge"
      className="inline-flex items-center text-[var(--text-xs)] font-medium px-[var(--space-2)] py-0.5 rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border border-[var(--color-border)] font-mono"
    >
      {t('hub.designSystems.source.folder', { name })}
    </span>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function DesignSystemsTab() {
  const t = useT();
  const ds = useEffectiveDesignSystem();
  const updateDesignSystemTokens = useCodesignStore((s) => s.updateDesignSystemTokens);
  const importDesignSystemFromUrl = useCodesignStore((s) => s.importDesignSystemFromUrl);
  const [importing, setImporting] = useState(false);

  const hasBridge = typeof window !== 'undefined' && !!window.codesign;

  const sourceKind = ds.source?.kind ?? 'folder';
  const isBuiltIn = ds.isBuiltIn === true;
  const isUserEdited = ds.userEdited === true;
  const displayName = ds.displayName ?? ds.rootPath;

  async function patch(update: DesignSystemTokenPatch) {
    await updateDesignSystemTokens(update);
  }

  function makeEditor<K extends keyof DesignSystemTokenPatch>(key: K, arr: string[]) {
    return {
      onEdit: (i: number, v: string) => {
        const next = [...arr];
        next[i] = v;
        void patch({ [key]: next } as DesignSystemTokenPatch);
      },
      onRemove: (i: number) => {
        const next = arr.filter((_, idx) => idx !== i);
        void patch({ [key]: next } as DesignSystemTokenPatch);
      },
      onAdd: (v = 'new-value') => {
        void patch({ [key]: [...arr, v] } as DesignSystemTokenPatch);
      },
    };
  }

  const colorsEditor = makeEditor('colors', ds.colors);
  const fontsEditor = makeEditor('fonts', ds.fonts);
  const spacingEditor = makeEditor('spacing', ds.spacing);
  const radiusEditor = makeEditor('radius', ds.radius);
  const shadowsEditor = makeEditor('shadows', ds.shadows);

  const components: StoredDesignComponent[] = ds.components ?? [];

  function makeComponentEditor() {
    return {
      onEditName: (i: number, v: string) => {
        const next = components.map((c, idx) => (idx === i ? { ...c, name: v } : c));
        void patch({ components: next });
      },
      onEditRule: (i: number, v: string) => {
        const next = components.map((c, idx) => (idx === i ? { ...c, rule: v } : c));
        void patch({ components: next });
      },
      onRemove: (i: number) => {
        void patch({ components: components.filter((_, idx) => idx !== i) });
      },
      onAdd: () => {
        void patch({
          components: [
            ...components,
            {
              name: t('hub.designSystems.components.newName'),
              rule: t('hub.designSystems.components.newRule'),
            },
          ],
        });
      },
    };
  }

  const componentsEditor = makeComponentEditor();

  async function handleImportUrl(url: string) {
    setImporting(true);
    try {
      await importDesignSystemFromUrl(url);
    } finally {
      setImporting(false);
    }
  }

  if (!hasBridge) {
    return (
      <section className="max-w-[var(--size-prose-narrow)] space-y-[var(--space-4)]">
        <h2 className="display text-[var(--text-lg)] tracking-[var(--tracking-heading)] text-[var(--color-text-primary)] m-0">
          {t('hub.designSystems.title')}
        </h2>
        <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
          {t('hub.designSystems.unavailable')}
        </p>
      </section>
    );
  }

  return (
    <section className="max-w-[var(--size-prose-narrow)] space-y-[var(--space-8)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-[var(--space-4)] pb-[var(--space-6)] border-b border-[var(--color-border-subtle)]">
        <div className="space-y-[var(--space-2)]">
          <h2
            className="text-[var(--text-xl)] tracking-[var(--tracking-heading)] leading-[var(--leading-heading)] text-[var(--color-text-primary)] m-0 font-normal"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {displayName}
          </h2>
          <div className="flex items-center gap-[var(--space-2)]">
            <SourceBadge
              kind={sourceKind}
              value={(ds.source as { kind: string; value?: string } | undefined)?.value}
              displayName={displayName}
            />
            {isUserEdited && !isBuiltIn && (
              <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                · {t('hub.designSystems.customized')}
              </span>
            )}
          </div>
          {isBuiltIn && (
            <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] leading-[var(--leading-body)] max-w-[52ch] pt-[var(--space-1)]">
              {t('hub.designSystems.builtInHint')}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          <ImportDesignSystemMenu onImportUrl={handleImportUrl} importing={importing} />
        </div>
      </div>

      {/* Colors */}
      <TokenPanel
        title={t('hub.designSystems.tokens.colors')}
        onAdd={() => colorsEditor.onAdd('#cccccc')}
        addLabel={t('hub.designSystems.tokens.add')}
      >
        {ds.colors.length === 0 ? (
          <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
            {t('hub.designSystems.tokens.empty', { category: 'color' })}
          </p>
        ) : (
          <div className="flex flex-wrap gap-[var(--space-5)]">
            {ds.colors.map((c, i) => (
              <TokenSwatch
                key={i}
                value={c}
                index={i}
                onEdit={colorsEditor.onEdit}
                onRemove={colorsEditor.onRemove}
              />
            ))}
          </div>
        )}
      </TokenPanel>

      {/* Typography */}
      <TokenPanel
        title={t('hub.designSystems.tokens.typography')}
        onAdd={() => fontsEditor.onAdd('system-ui, sans-serif')}
        addLabel={t('hub.designSystems.tokens.add')}
      >
        {ds.fonts.length === 0 ? (
          <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
            {t('hub.designSystems.tokens.empty', { category: 'font' })}
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {ds.fonts.map((f, i) => (
              <TypographySpecimen
                key={i}
                value={f}
                index={i}
                onEdit={fontsEditor.onEdit}
                onRemove={fontsEditor.onRemove}
              />
            ))}
          </div>
        )}
      </TokenPanel>

      {/* Spacing */}
      <TokenPanel
        title={t('hub.designSystems.tokens.spacing')}
        onAdd={() => spacingEditor.onAdd('16px')}
        addLabel={t('hub.designSystems.tokens.add')}
      >
        {ds.spacing.length === 0 ? (
          <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
            {t('hub.designSystems.tokens.empty', { category: 'spacing' })}
          </p>
        ) : (
          <div className="space-y-[var(--space-2)]">
            {ds.spacing.map((s, i) => (
              <SpacingChip
                key={i}
                value={s}
                index={i}
                onEdit={spacingEditor.onEdit}
                onRemove={spacingEditor.onRemove}
              />
            ))}
          </div>
        )}
      </TokenPanel>

      {/* Radius */}
      <TokenPanel
        title={t('hub.designSystems.tokens.radius')}
        onAdd={() => radiusEditor.onAdd('8px')}
        addLabel={t('hub.designSystems.tokens.add')}
      >
        {ds.radius.length === 0 ? (
          <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
            {t('hub.designSystems.tokens.empty', { category: 'radius' })}
          </p>
        ) : (
          <div className="space-y-[var(--space-1)]">
            {ds.radius.map((r, i) => (
              <SimpleTokenRow
                key={i}
                value={r}
                index={i}
                onEdit={radiusEditor.onEdit}
                onRemove={radiusEditor.onRemove}
                previewClass="bg-[var(--color-surface-raised)]"
                previewStyle={{ borderRadius: r }}
              />
            ))}
          </div>
        )}
      </TokenPanel>

      {/* Shadows */}
      <TokenPanel
        title={t('hub.designSystems.tokens.shadows')}
        onAdd={() => shadowsEditor.onAdd('0 2px 8px rgba(0,0,0,0.12)')}
        addLabel={t('hub.designSystems.tokens.add')}
      >
        {ds.shadows.length === 0 ? (
          <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
            {t('hub.designSystems.tokens.empty', { category: 'shadow' })}
          </p>
        ) : (
          <div className="space-y-[var(--space-2)]">
            {ds.shadows.map((sh, i) => (
              <SimpleTokenRow
                key={i}
                value={sh}
                index={i}
                onEdit={shadowsEditor.onEdit}
                onRemove={shadowsEditor.onRemove}
                previewClass="bg-[var(--color-surface)]"
                previewStyle={{ boxShadow: sh }}
              />
            ))}
          </div>
        )}
      </TokenPanel>

      {/* Components */}
      <TokenPanel
        title={t('hub.designSystems.tokens.components')}
        onAdd={componentsEditor.onAdd}
        addLabel={t('hub.designSystems.tokens.add')}
      >
        {components.length === 0 ? (
          <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
            {t('hub.designSystems.tokens.empty', { category: 'component' })}
          </p>
        ) : (
          <div className="space-y-[var(--space-2)]">
            {components.map((c, i) => (
              <ComponentRow
                key={i}
                name={c.name}
                rule={c.rule}
                index={i}
                onEditName={componentsEditor.onEditName}
                onEditRule={componentsEditor.onEditRule}
                onRemove={componentsEditor.onRemove}
              />
            ))}
          </div>
        )}
      </TokenPanel>
    </section>
  );
}
