import type { StoredDesignSystem } from '@atv-design/shared';
import type Database from 'better-sqlite3';
import {
  createDefaultDesignSystemSnapshot,
  ensureWorkspaceDesignSystem,
} from './default-design-system';
import { scanDesignSystem } from './design-system';
import { getLogger } from './logger';
import { getDesign } from './snapshots-db';

const logger = getLogger('design-system-resolver');

export async function resolveDesignSystemForDesign(
  db: Database.Database | null,
  designId: string | null | undefined,
  fallback: StoredDesignSystem | null,
): Promise<StoredDesignSystem> {
  if (db !== null && typeof designId === 'string' && designId.trim().length > 0) {
    const design = getDesign(db, designId);
    if (design?.workspacePath) {
      try {
        await ensureWorkspaceDesignSystem(design.workspacePath, design.name);
        return await scanDesignSystem(design.workspacePath);
      } catch (err) {
        logger.warn('workspace_design_system.resolve_failed', {
          designId,
          workspacePath: design.workspacePath,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return fallback ?? createDefaultDesignSystemSnapshot();
}
