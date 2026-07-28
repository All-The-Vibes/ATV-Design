/**
 * Exporter entry point. Each format lives in its own subpath export and is
 * loaded lazily so the cold-start bundle stays lean (PRINCIPLES §1).
 *
 * Tier 1 ships HTML, PDF, PPTX, and ZIP — all four lazy-loaded so the heavy
 * runtime deps (`puppeteer-core`, `pptxgenjs`, `zip-lib`) only enter the
 * module graph the first time a user actually exports.
 */

import { CodesignError, ERROR_CODES } from '@atv-design/shared';

export const EXPORTER_FORMATS = ['html', 'pdf', 'pptx', 'zip', 'markdown'] as const;
export type ExporterFormat = (typeof EXPORTER_FORMATS)[number];

/**
 * What the exporter is handed.
 *
 * Every exporter in this package consumes **rendered HTML**, never the
 * agent's raw source. That was previously implicit — the field was called
 * `htmlContent` and callers passed `previewHtml`, which is actually the
 * agent's uncompiled JSX module. Every format silently emitted unexecutable
 * JSX text as a result.
 *
 * The discriminant makes the contract checkable: `kind: 'jsx'` must be
 * compiled (via `@atv-design/runtime`'s `buildSrcdoc`) *before* dispatch, so
 * that by the time any exporter runs, `kind` is always `'html'`.
 */
export type ArtifactSource = { kind: 'jsx'; source: string } | { kind: 'html'; source: string };

/**
 * Narrow an `ArtifactSource` to the rendered HTML the exporters require.
 * Throws rather than silently exporting uncompiled JSX.
 */
export function requireRenderedHtml(artifact: ArtifactSource): string {
  if (artifact.kind !== 'html') {
    throw new CodesignError(
      'Exporter received uncompiled JSX. The artifact must be compiled before dispatch.',
      ERROR_CODES.EXPORTER_COMPILE_FAILED,
    );
  }
  return artifact.source;
}

export interface ExportOptions {
  artifactId: string;
  destinationPath: string;
}

export interface ExportResult {
  bytes: number;
  path: string;
}

export function isExporterReady(_format: ExporterFormat): boolean {
  return true;
}

export type { ExportHtmlOptions } from './html';
export type { ExportPdfOptions } from './pdf';
export type { ExportPptxOptions } from './pptx';
export type { ExportZipOptions, ZipAsset } from './zip';
export type { ExportMarkdownOptions, MarkdownMeta } from './markdown';
export { htmlToMarkdown } from './markdown';

export async function exportHtml(
  renderedHtml: string,
  destinationPath: string,
  opts?: import('./html').ExportHtmlOptions,
): Promise<ExportResult> {
  const mod = await import('./html');
  return mod.exportHtml(renderedHtml, destinationPath, opts);
}

/**
 * Dispatch a rendered artifact to one of the format exporters.
 *
 * `artifact` is the discriminated `ArtifactSource`: anything still tagged
 * `'jsx'` is rejected here rather than being written to disk as literal,
 * unexecutable source text.
 */
export async function exportArtifact(
  format: ExporterFormat,
  artifact: ArtifactSource,
  destinationPath: string,
): Promise<ExportResult> {
  const renderedHtml = requireRenderedHtml(artifact);
  if (format === 'html') {
    return exportHtml(renderedHtml, destinationPath);
  }
  if (format === 'pdf') {
    const mod = await import('./pdf');
    return mod.exportPdf(renderedHtml, destinationPath);
  }
  if (format === 'pptx') {
    const mod = await import('./pptx');
    return mod.exportPptx(renderedHtml, destinationPath);
  }
  if (format === 'zip') {
    const mod = await import('./zip');
    return mod.exportZip(renderedHtml, destinationPath);
  }
  if (format === 'markdown') {
    const mod = await import('./markdown');
    return mod.exportMarkdown(renderedHtml, destinationPath);
  }
  throw new CodesignError(
    `Unknown exporter format: ${format as string}`,
    ERROR_CODES.EXPORTER_UNKNOWN,
  );
}
