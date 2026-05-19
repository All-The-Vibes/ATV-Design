import { useT } from '@atv-design/i18n';
import { useRef, useState } from 'react';
import { useCodesignStore } from '../../store';

interface ImportDesignSystemMenuProps {
  onImportUrl: (url: string) => Promise<void>;
  importing: boolean;
}

export function ImportDesignSystemMenu({ onImportUrl, importing }: ImportDesignSystemMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [url, setUrl] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const pickDesignSystemDirectory = useCodesignStore((s) => s.pickDesignSystemDirectory);
  const clearDesignSystem = useCodesignStore((s) => s.clearDesignSystem);
  const importDesignSystemFromFiles = useCodesignStore((s) => s.importDesignSystemFromFiles);

  async function handleImportUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setOpen(false);
    setShowUrlForm(false);
    await onImportUrl(url.trim());
    setUrl('');
  }

  async function handleImportFiles() {
    setOpen(false);
    setShowUrlForm(false);
    if (!window.codesign?.pickInputFiles) return;
    try {
      const files = await window.codesign.pickInputFiles();
      const paths = files
        .map((f) => f.path)
        .filter((p): p is string => typeof p === 'string' && p.length > 0);
      const cssLike = paths.filter((p) => /\.(css|scss|sass|less|json|md|ts|js)$/i.test(p));
      const toImport = cssLike.length > 0 ? cssLike : paths;
      if (toImport.length > 0) {
        await importDesignSystemFromFiles(toImport);
      }
    } catch {
      // User cancelled or bridge unavailable — silently no-op
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        disabled={importing}
        onClick={() => {
          setOpen((v) => !v);
          setShowUrlForm(false);
        }}
        className="inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-1_5)] text-[var(--text-sm)] font-medium bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {importing ? t('hub.designSystems.importing') : t('hub.designSystems.import')}
        <span className="text-[10px]">▾</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setOpen(false);
              setShowUrlForm(false);
            }}
          />
          <div className="absolute right-0 top-full mt-[var(--space-1)] z-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] min-w-[220px] overflow-hidden">
            {/* Folder */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void pickDesignSystemDirectory();
              }}
              className="w-full text-left px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
            >
              {t('hub.designSystems.importFolder')}
            </button>

            {/* URL */}
            <button
              type="button"
              onClick={() => setShowUrlForm((v) => !v)}
              className="w-full text-left px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
            >
              {t('hub.designSystems.importUrl')}
            </button>

            {showUrlForm && (
              <form
                onSubmit={(e) => void handleImportUrl(e)}
                className="px-[var(--space-3)] pb-[var(--space-2)] flex gap-[var(--space-1)]"
              >
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={t('hub.designSystems.importUrlPlaceholder')}
                  className="flex-1 text-[var(--text-xs)] border border-[var(--color-border)] rounded px-[var(--space-2)] py-[var(--space-1)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-focus)]"
                />
                <button
                  type="submit"
                  disabled={!url.trim()}
                  className="text-[var(--text-xs)] px-[var(--space-2)] py-[var(--space-1)] rounded bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {t('hub.designSystems.importUrlSubmit')}
                </button>
              </form>
            )}

            {/* Files */}
            <button
              type="button"
              onClick={() => void handleImportFiles()}
              className="w-full text-left px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
            >
              {t('hub.designSystems.importFiles')}
            </button>

            <div className="border-t border-[var(--color-border)]" />

            {/* Use built-in */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void clearDesignSystem();
              }}
              className="w-full text-left px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
            >
              {t('hub.designSystems.useBuiltIn')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
