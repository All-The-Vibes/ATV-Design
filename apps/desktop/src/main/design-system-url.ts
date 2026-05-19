import { STORED_DESIGN_SYSTEM_SCHEMA_VERSION, type StoredDesignSystem } from '@atv-design/shared';
import { buildSummary, collectCssVarValues, collectLooseValues } from './design-system';
import { getLogger } from './logger';

const log = getLogger('design-system-url');

const MAX_STYLESHEETS = 8;
const MAX_STYLESHEET_BYTES = 256 * 1024; // 256 KB
const FETCH_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out fetching ${label}`)), ms),
    ),
  ]);
}

function extractStylesheetUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const base = new URL(baseUrl);

  // <link rel="stylesheet" href="...">
  for (const match of html.matchAll(
    /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
  )) {
    const href = match[1];
    if (!href) continue;
    try {
      const resolved = new URL(href, base);
      // Only same-origin stylesheets
      if (resolved.hostname === base.hostname) {
        urls.push(resolved.href);
      }
    } catch {
      // skip malformed
    }
    if (urls.length >= MAX_STYLESHEETS) break;
  }

  // also handle href before rel
  for (const match of html.matchAll(
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi,
  )) {
    const href = match[1];
    if (!href) continue;
    try {
      const resolved = new URL(href, base);
      if (resolved.hostname === base.hostname && !urls.includes(resolved.href)) {
        urls.push(resolved.href);
      }
    } catch {
      // skip
    }
    if (urls.length >= MAX_STYLESHEETS) break;
  }

  return urls.slice(0, MAX_STYLESHEETS);
}

function extractInlineStyles(html: string): string[] {
  const styles: string[] = [];
  for (const match of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (match[1]) styles.push(match[1]);
  }
  return styles;
}

async function fetchText(url: string, maxBytes: number): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'ATV-Design/1.0 (design-system-importer)' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, maxBytes));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export async function extractDesignSystemFromUrl(url: string): Promise<StoredDesignSystem> {
  log.info('url.import.start', { url });

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const colors: string[] = [];
  const fonts: string[] = [];
  const spacing: string[] = [];
  const radius: string[] = [];
  const shadows: string[] = [];
  const sourceFiles: string[] = [];

  // Fetch the HTML page
  const html = await withTimeout(fetchText(url, MAX_STYLESHEET_BYTES), FETCH_TIMEOUT_MS, url);

  // Extract inline <style> blocks
  const inlineStyles = extractInlineStyles(html);
  for (const style of inlineStyles) {
    collectCssVarValues(style, colors, spacing, radius, shadows);
    collectLooseValues(style, colors, fonts, spacing, radius, shadows);
  }

  // Find linked stylesheets
  const stylesheetUrls = extractStylesheetUrls(html, url);
  log.info('url.import.stylesheets', { count: stylesheetUrls.length });

  for (const cssUrl of stylesheetUrls) {
    try {
      const css = await withTimeout(
        fetchText(cssUrl, MAX_STYLESHEET_BYTES),
        FETCH_TIMEOUT_MS,
        cssUrl,
      );
      collectCssVarValues(css, colors, spacing, radius, shadows);
      collectLooseValues(css, colors, fonts, spacing, radius, shadows);
      sourceFiles.push(cssUrl);
    } catch (err) {
      log.warn('url.import.stylesheet.failed', { cssUrl, err: String(err) });
    }
  }

  // Include the base URL as a source file reference
  sourceFiles.unshift(url);

  const baseSnapshot = {
    rootPath: url,
    sourceFiles,
    colors,
    fonts,
    spacing,
    radius,
    shadows,
  };

  const result: StoredDesignSystem = {
    schemaVersion: STORED_DESIGN_SYSTEM_SCHEMA_VERSION,
    ...baseSnapshot,
    summary: buildSummary(baseSnapshot),
    extractedAt: new Date().toISOString(),
    source: { kind: 'url', value: url },
    displayName: parsedUrl.hostname,
  };

  log.info('url.import.ok', {
    url,
    colors: colors.length,
    fonts: fonts.length,
    spacing: spacing.length,
  });

  return result;
}
