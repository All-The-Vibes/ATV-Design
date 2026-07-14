import { useT } from '@atv-design/i18n';
import type { Design } from '@atv-design/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useCodesignStore } from '../../store';
import { DesignGrid } from './DesignGrid';

const RECENT_LIMIT = 6;
export const HIDE_EMPTY_KEY = 'hub:recent:hideEmpty';

/** A design counts as "empty" when it has no snapshots yet (shells, aborted
 * generations, repro entries). `snapshotCount` is optional for back-compat, so
 * a missing value is treated as empty. */
function isEmptyDesign(d: Design): boolean {
  return (d.snapshotCount ?? 0) === 0;
}

function liveDesigns(designs: Design[]): Design[] {
  return designs.filter((d) => d.deletedAt === null);
}

/** Live designs, optionally hiding empties, newest-first, capped at `limit`. */
export function selectRecent(designs: Design[], hideEmpty: boolean, limit: number): Design[] {
  return liveDesigns(designs)
    .filter((d) => (hideEmpty ? !isEmptyDesign(d) : true))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, limit);
}

/** Number of live designs that have no snapshots. */
export function countEmpty(designs: Design[]): number {
  return liveDesigns(designs).filter(isEmptyDesign).length;
}

/** True when the hide-empty switch would actually change the visible Recent
 * grid — i.e. hiding empties drops at least one design from the first `limit`
 * cards. Gating on this (rather than "any empty design exists anywhere") avoids
 * showing a no-op control when the only empty designs sit outside the visible
 * window. */
export function shouldOfferHideEmpty(designs: Design[], limit: number): boolean {
  const shown = selectRecent(designs, false, limit);
  const hidden = selectRecent(designs, true, limit);
  return shown.length !== hidden.length || shown.some((d, i) => d.id !== hidden[i]?.id);
}

/** True when the hide-empty filter is on AND it collapses the entire visible
 * Recent list (every design that would show is empty). This is the case the
 * grid's own empty-state cannot surface, because the "+ New design" prefix tile
 * keeps the grid non-empty. */
export function shouldShowAllHiddenHint(
  designs: Design[],
  hideEmpty: boolean,
  limit: number,
): boolean {
  if (!hideEmpty) return false;
  const shown = selectRecent(designs, false, limit);
  return shown.length > 0 && shown.every(isEmptyDesign);
}

function readHideEmpty(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(HIDE_EMPTY_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHideEmpty(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(HIDE_EMPTY_KEY, value ? '1' : '0');
  } catch {
    /* storage unavailable — in-memory state still applies for this session */
  }
}

export function RecentTab() {
  const t = useT();
  const designs = useCodesignStore((s) => s.designs);
  const openNewDesignDialog = useCodesignStore((s) => s.openNewDesignDialog);
  const isGenerating = useCodesignStore(
    (s) => s.isGenerating && s.generatingDesignId === s.currentDesignId,
  );
  const [hideEmpty, setHideEmpty] = useState<boolean>(readHideEmpty);

  const offerHideEmpty = shouldOfferHideEmpty(designs, RECENT_LIMIT);
  const recent = selectRecent(designs, hideEmpty, RECENT_LIMIT);
  const allHidden = shouldShowAllHiddenHint(designs, hideEmpty, RECENT_LIMIT);

  function toggleHideEmpty(): void {
    setHideEmpty((prev) => {
      const next = !prev;
      writeHideEmpty(next);
      return next;
    });
  }

  function handleNewDesign(): void {
    openNewDesignDialog();
  }

  const newDesignTile = (
    <button
      type="button"
      onClick={() => void handleNewDesign()}
      disabled={isGenerating}
      aria-label={t('hub.newDesign')}
      data-testid="sidebar-button-new-design"
      className="group relative flex w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="relative w-full aspect-[4/3] flex flex-col items-center justify-center gap-[var(--space-4)] rounded-[var(--radius-lg)] border-[1.5px] border-dashed border-[var(--color-border)] bg-[linear-gradient(135deg,var(--color-background-secondary)_0%,var(--color-accent-soft)_100%)] transition-[transform,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:-translate-y-[2px] group-hover:border-[var(--color-accent)] group-disabled:translate-y-0 group-disabled:border-[var(--color-border)] overflow-hidden">
        <span
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,var(--color-accent-soft)_0%,transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--duration-base)]"
        />
        <span className="relative inline-flex items-center justify-center w-[64px] h-[64px] rounded-full bg-[var(--color-surface)] border border-[var(--color-border-muted)] text-[var(--color-accent)] shadow-[var(--shadow-soft)] group-hover:scale-110 group-hover:shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)]">
          <Plus className="w-[28px] h-[28px]" strokeWidth={2} aria-hidden />
        </span>
        <div className="relative flex flex-col items-center gap-[var(--space-1)] px-[var(--space-4)] text-center">
          <span
            className="text-[var(--text-lg)] text-[var(--color-text-primary)] tracking-[var(--tracking-tight)]"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
          >
            {t('hub.newDesignCardTitle')}
          </span>
          <span className="text-[11px] text-[var(--color-text-muted)] leading-[var(--leading-ui)]">
            {t('hub.newDesignCardSub')}
          </span>
        </div>
      </div>
    </button>
  );

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {offerHideEmpty ? (
        <div className="flex items-center justify-end">
          <button
            type="button"
            role="switch"
            aria-checked={hideEmpty}
            onClick={toggleHideEmpty}
            data-testid="recent-toggle-hide-empty"
            className="inline-flex items-center gap-[var(--space-2)] rounded-full border border-[var(--color-border)] bg-[var(--color-background-secondary)] px-[var(--space-3)] py-[var(--space-1)] text-[var(--font-size-body-sm)] text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-faster)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
          >
            <span
              aria-hidden
              className={`inline-flex h-[16px] w-[28px] items-center rounded-full p-[2px] transition-colors duration-[var(--duration-faster)] ${
                hideEmpty ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]'
              }`}
            >
              <span
                className={`h-[12px] w-[12px] rounded-full bg-white transition-transform duration-[var(--duration-faster)] ${
                  hideEmpty ? 'translate-x-[12px]' : 'translate-x-0'
                }`}
              />
            </span>
            {t('hub.recent.hideEmpty')}
          </button>
        </div>
      ) : null}
      <DesignGrid designs={recent} emptyLabel={t('hub.recent.empty')} prefixTile={newDesignTile} />
      {allHidden ? (
        <p
          data-testid="recent-all-empty-hint"
          className="text-center text-[var(--font-size-body-sm)] text-[var(--color-text-muted)]"
        >
          {t('hub.recent.allEmpty')}
        </p>
      ) : null}
    </div>
  );
}
