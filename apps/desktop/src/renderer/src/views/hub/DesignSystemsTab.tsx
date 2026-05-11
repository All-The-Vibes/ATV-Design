import { useT } from '@atv-design/i18n';
import { useCodesignStore } from '../../store';

export function DesignSystemsTab() {
  const t = useT();
  const config = useCodesignStore((s) => s.config);
  const pickDesignSystemDirectory = useCodesignStore((s) => s.pickDesignSystemDirectory);
  const clearDesignSystem = useCodesignStore((s) => s.clearDesignSystem);

  const hasBridge = typeof window !== 'undefined' && !!window.codesign;
  const ds = config?.designSystem ?? null;

  return (
    <section className="max-w-[var(--size-prose-narrow)] space-y-[var(--space-4)]">
      <h2 className="display text-[var(--text-lg)] tracking-[var(--tracking-heading)] text-[var(--color-text-primary)] m-0">
        {t('hub.designSystems.title')}
      </h2>

      {!hasBridge ? (
        <div className="space-y-[var(--space-3)]">
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] leading-[var(--leading-body)]">
            {t('hub.designSystems.unavailable')}
          </p>
          <button
            disabled
            className="inline-flex items-center gap-[var(--space-1_5)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-1_5)] text-[var(--text-sm)] font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-disabled)] cursor-not-allowed"
          >
            {t('hub.designSystems.add')}
          </button>
        </div>
      ) : ds === null ? (
        <div className="space-y-[var(--space-3)]">
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] leading-[var(--leading-body)]">
            {t('hub.designSystems.noDesignSystem')}
          </p>
          <button
            onClick={() => void pickDesignSystemDirectory()}
            className="inline-flex items-center gap-[var(--space-1_5)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-1_5)] text-[var(--text-sm)] font-medium bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90 transition-opacity"
          >
            {t('hub.designSystems.add')}
          </button>
        </div>
      ) : (
        <div className="space-y-[var(--space-3)]">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-[var(--space-3)] space-y-[var(--space-1-5)]">
            <div className="flex items-center gap-[var(--space-1-5)]">
              <span className="text-[var(--text-xs)] font-medium text-[var(--color-accent)] uppercase tracking-wide">
                {t('hub.designSystems.linked')}
              </span>
            </div>
            <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] leading-[var(--leading-body)] font-mono break-all">
              {t('hub.designSystems.rootPath', { path: ds.rootPath })}
            </p>
            {ds.summary && (
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] leading-[var(--leading-body)]">
                {ds.summary}
              </p>
            )}
          </div>
          <div className="flex gap-[var(--space-2)]">
            <button
              onClick={() => void pickDesignSystemDirectory()}
              className="inline-flex items-center gap-[var(--space-1_5)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-1_5)] text-[var(--text-sm)] font-medium bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90 transition-opacity"
            >
              {t('hub.designSystems.add')}
            </button>
            <button
              onClick={() => void clearDesignSystem()}
              className="inline-flex items-center gap-[var(--space-1_5)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-1_5)] text-[var(--text-sm)] font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
            >
              {t('hub.designSystems.remove')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
