import { type ArtifactSource, type ExporterFormat, exportArtifact } from '@atv-design/exporters';
import { CodesignError, ERROR_CODES } from '@atv-design/shared';
import type { BrowserWindow } from 'electron';
import { dialog, ipcMain } from './electron-runtime';

const FORMAT_FILTERS: Record<ExporterFormat, Electron.FileFilter[]> = {
  html: [{ name: 'HTML', extensions: ['html'] }],
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
  pptx: [{ name: 'PowerPoint', extensions: ['pptx'] }],
  zip: [{ name: 'ZIP archive', extensions: ['zip'] }],
  markdown: [{ name: 'Markdown', extensions: ['md'] }],
};

export interface ExportRequest {
  format: ExporterFormat;
  /**
   * The artifact to export. Narrowed to `kind: 'html'` deliberately: the
   * renderer compiles JSX via `buildSrcdoc` before invoking, and
   * `parseRequest` rejects anything still tagged `'jsx'`. Encoding that in
   * the type means a compiled artifact is guaranteed by construction, not
   * merely by convention.
   */
  artifactSource: Extract<ArtifactSource, { kind: 'html' }>;
  defaultFilename?: string;
}

export interface ExportResponse {
  status: 'saved' | 'cancelled';
  path?: string;
  bytes?: number;
}

export function parseRequest(raw: unknown): ExportRequest {
  if (raw === null || typeof raw !== 'object') {
    throw new CodesignError('export expects an object payload', ERROR_CODES.IPC_BAD_INPUT);
  }
  const r = raw as Record<string, unknown>;
  const format = r['format'];
  const artifact = r['artifactSource'];
  const defaultFilename = r['defaultFilename'];
  if (
    format !== 'html' &&
    format !== 'pdf' &&
    format !== 'pptx' &&
    format !== 'zip' &&
    format !== 'markdown'
  ) {
    throw new CodesignError(
      `Unknown export format: ${String(format)}`,
      ERROR_CODES.EXPORTER_UNKNOWN,
    );
  }
  if (artifact === null || typeof artifact !== 'object') {
    throw new CodesignError('export requires an artifactSource object', ERROR_CODES.IPC_BAD_INPUT);
  }
  const a = artifact as Record<string, unknown>;
  const kind = a['kind'];
  const source = a['source'];
  if (typeof source !== 'string' || source.length === 0) {
    throw new CodesignError(
      'export requires a non-empty artifactSource.source',
      ERROR_CODES.IPC_BAD_INPUT,
    );
  }
  if (kind !== 'html' && kind !== 'jsx') {
    throw new CodesignError(
      `Unknown artifactSource.kind: ${String(kind)}`,
      ERROR_CODES.IPC_BAD_INPUT,
    );
  }
  // Compilation is the renderer's job (it owns `buildSrcdoc` and the same
  // path the preview uses). Reaching main still tagged as JSX means the
  // caller skipped it — fail loudly instead of exporting unexecutable source.
  if (kind === 'jsx') {
    throw new CodesignError(
      'export received uncompiled JSX; the renderer must compile before invoking',
      ERROR_CODES.EXPORTER_COMPILE_FAILED,
    );
  }
  const out: ExportRequest = { format, artifactSource: { kind, source } };
  if (typeof defaultFilename === 'string' && defaultFilename.length > 0) {
    out.defaultFilename = defaultFilename;
  }
  return out;
}

export function registerExporterIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('codesign:export', async (_evt, raw: unknown): Promise<ExportResponse> => {
    const req = parseRequest(raw);
    const win = getWindow();
    const defaultExt = req.format === 'markdown' ? 'md' : req.format;
    const opts: Electron.SaveDialogOptions = {
      title: `Export design as ${req.format.toUpperCase()}`,
      defaultPath: req.defaultFilename ?? `design.${defaultExt}`,
      filters: FORMAT_FILTERS[req.format],
    };
    const picked = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (picked.canceled || !picked.filePath) {
      return { status: 'cancelled' };
    }

    // All four formats ship in tier 1; the heavy deps load lazily inside
    // exportArtifact. Errors propagate to the renderer as toasts (PRINCIPLES §10).
    const result = await exportArtifact(req.format, req.artifactSource, picked.filePath);
    return { status: 'saved', path: result.path, bytes: result.bytes };
  });
}
