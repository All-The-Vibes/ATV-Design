/// <reference lib="dom" />
/**
 * read_brand — ingest brand identity from a live URL, a Git/local repo, or a
 * screenshot image. Extracts color tokens, type stack, and spacing scale, then
 * writes/updates the workspace DESIGN.md.
 *
 * Heavy deps (puppeteer-core, child_process git clone) are lazy-imported inside
 * execute() — they MUST NOT appear at module top-level (HC #6).
 *
 * NOTE: the triple-slash above includes the DOM lib for type-checking the
 * page.evaluate(() => {...}) callbacks below (they execute in the browser).
 * Lib is file-scoped — does not affect any other module's lib resolution.
 */

import type { StoredDesignSystem } from '@atv-design/shared';
import { STORED_DESIGN_SYSTEM_SCHEMA_VERSION, findSystemChrome } from '@atv-design/shared';
import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import { Type } from '@sinclair/typebox';
import type { DesignToken } from '../brand/index.js';
import { type SpacingScale, inferSpacingScale } from '../brand/spacingInferrer.js';
import { type TypeRamp, inferTypeRamp } from '../brand/typographyInferrer.js';

// ── Params ────────────────────────────────────────────────────────────────────

const ReadBrandParams = Type.Object({
  source: Type.Object({
    kind: Type.Union([Type.Literal('url'), Type.Literal('repo'), Type.Literal('image')]),
    value: Type.String({ minLength: 1 }),
  }),
  mergeMode: Type.Optional(Type.Union([Type.Literal('merge'), Type.Literal('replace')])),
});

// ── Public types ──────────────────────────────────────────────────────────────

export interface ReadBrandDetails {
  source: { kind: 'url' | 'repo' | 'image'; value: string };
  colorsFound: number;
  fontsFound: number;
  spacingFound: number;
  designMdPath: string | null;
  warnings: string[];
}

export interface ReadBrandDeps {
  /** Workspace root for the active design — DESIGN.md is written here. */
  workspacePath: string | null;
  /**
   * Optional FS abstraction used by other tools. If null, read-only mode
   * (returns extracted tokens as text only, does not write DESIGN.md).
   */
  fs?: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
  } | null;
  /** Project logger — never use console.* per CLAUDE.md constraint. */
  log?: {
    info: (event: string, data?: Record<string, unknown>) => void;
    warn: (event: string, data?: Record<string, unknown>) => void;
    error: (event: string, data?: Record<string, unknown>) => void;
  };
}

// ── Synthesizer ───��───────────────────────────────────────────────────────────

export interface SynthesizeBrandOpts {
  sourceValue: string;
  workspacePath?: string | null;
  sourceFiles?: string[];
}

/**
 * Convert a flat list of DesignToken[] into the StoredDesignSystem shape,
 * without needing a real directory scan.
 */
export function synthesizeBrand(
  tokens: DesignToken[],
  opts: SynthesizeBrandOpts,
): StoredDesignSystem {
  const pick = <T>(arr: T[], max: number): T[] => arr.slice(0, max);

  const colors = pick(
    tokens.filter((t) => t.type === 'color').map((t) => t.value),
    24,
  );
  const fonts = pick(
    tokens.filter((t) => t.type === 'fontFamily' || t.type === 'fontSize').map((t) => t.value),
    16,
  );
  const spacing = pick(
    tokens.filter((t) => t.type === 'spacing').map((t) => t.value),
    16,
  );
  const radius = pick(
    tokens.filter((t) => t.type === 'radius').map((t) => t.value),
    16,
  );
  const shadows = pick(
    tokens.filter((t) => t.type === 'shadow').map((t) => t.value),
    16,
  );

  const date = new Date().toISOString().slice(0, 10);
  const summary = `Extracted from ${opts.sourceValue} on ${date}`;

  return {
    schemaVersion: STORED_DESIGN_SYSTEM_SCHEMA_VERSION,
    rootPath: opts.workspacePath ?? '(none)',
    summary,
    extractedAt: new Date().toISOString(),
    sourceFiles: pick(opts.sourceFiles ?? [], 24),
    colors,
    fonts,
    spacing,
    radius,
    shadows,
  };
}

// ── Conflict detection ────────────────────────────────────────────────────────

/**
 * A single token-name conflict: the same `name` was extracted with two or more
 * distinct `value`s. Per-value `source` labels are derived from the token's
 * `origin` field (css-vars, tailwind-config, dtcg-json, …) — finer file-path
 * attribution would require threading file context through the fetchers, which
 * isn't worth the added surface area for v1 of this report.
 *
 * FIXME(slice-2.2): once fetchers can attach a file path per token (e.g.
 * `_sourceFile`), surface that here instead of `origin` for clearer reports.
 */
export interface TokenConflict {
  name: string;
  values: Array<{ value: string; source: string }>;
}

export function detectTokenConflicts(tokens: DesignToken[]): TokenConflict[] {
  // name → value → set of origin labels
  const byName = new Map<string, Map<string, Set<string>>>();
  for (const t of tokens) {
    const byValue = byName.get(t.name) ?? new Map<string, Set<string>>();
    const sources = byValue.get(t.value) ?? new Set<string>();
    sources.add(t.origin);
    byValue.set(t.value, sources);
    byName.set(t.name, byValue);
  }

  const out: TokenConflict[] = [];
  for (const [name, byValue] of byName) {
    if (byValue.size < 2) continue;
    const values = Array.from(byValue, ([value, sources]) => ({
      value,
      source: Array.from(sources).sort().join(', '),
    }));
    out.push({ name, values });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Numeric extraction helpers (for ramp / spacing inference) ────────────────

const REM_BASE_PX = 16;

/** Convert "16px" / "1rem" / "1.5em" to a px number. Returns null when the
 *  value isn't a single dimension we understand (multi-value, %, unitless, …). */
export function dimensionToPx(value: string): number | null {
  const m = /^\s*(-?\d*\.?\d+)\s*(px|rem|em)?\s*$/i.exec(value);
  if (!m) return null;
  const num = Number.parseFloat(m[1] as string);
  if (!Number.isFinite(num)) return null;
  const unit = (m[2] ?? 'px').toLowerCase();
  if (unit === 'px') return num;
  if (unit === 'rem' || unit === 'em') return num * REM_BASE_PX;
  return null;
}

function extractFontSizesPx(tokens: DesignToken[]): number[] {
  const out: number[] = [];
  for (const t of tokens) {
    if (t.type !== 'fontSize') continue;
    const px = dimensionToPx(t.value);
    if (px !== null) out.push(px);
  }
  return out;
}

function extractSpacingsPx(tokens: DesignToken[]): number[] {
  const out: number[] = [];
  for (const t of tokens) {
    if (t.type !== 'spacing') continue;
    const px = dimensionToPx(t.value);
    if (px !== null) out.push(px);
  }
  return out;
}

// ── DESIGN.md helpers ─────────────────────────────────────────────────────────

const DESIGN_MD_SCHEMA_VERSION = 1;
const MAX_FRONTMATTER_SOURCES = 10;

interface DesignMdFrontmatter {
  schemaVersion: number;
  extractedAt: string;
  sources: string[];
}

interface BuildDesignMdOpts {
  /** Current invocation's source — appended to the frontmatter sources list. */
  source: { kind: 'url' | 'repo' | 'image'; value: string };
  /** Previous frontmatter parsed from an existing DESIGN.md, if any. */
  existingFrontmatter?: DesignMdFrontmatter | null;
  conflicts?: TokenConflict[];
  typeRamp?: TypeRamp | null;
  spacingScale?: SpacingScale | null;
}

function formatSourceLabel(s: { kind: string; value: string }): string {
  return `${s.kind}:${s.value}`;
}

function mergeFrontmatterSources(
  existing: string[] | undefined,
  current: { kind: string; value: string },
): string[] {
  const formatted = formatSourceLabel(current);
  const merged = (existing ?? []).filter((s) => s !== formatted);
  merged.push(formatted);
  return merged.slice(-MAX_FRONTMATTER_SOURCES);
}

function buildFrontmatter(opts: BuildDesignMdOpts, extractedAt: string): DesignMdFrontmatter {
  return {
    schemaVersion: DESIGN_MD_SCHEMA_VERSION,
    extractedAt,
    sources: mergeFrontmatterSources(opts.existingFrontmatter?.sources, opts.source),
  };
}

function serializeFrontmatter(fm: DesignMdFrontmatter): string {
  const lines: string[] = [
    '---',
    `schemaVersion: ${fm.schemaVersion}`,
    `extractedAt: ${fm.extractedAt}`,
  ];
  if (fm.sources.length === 0) {
    lines.push('sources: []');
  } else {
    lines.push('sources:');
    for (const s of fm.sources) lines.push(`  - ${s}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

/**
 * Permissive YAML-frontmatter parser tuned for the keys we actually write
 * (`schemaVersion`, `extractedAt`, `sources`). Anything else is ignored.
 * Returns `null` when the frontmatter is missing, malformed, or missing a
 * required field — callers should rewrite from current invocation in that case.
 */
export function parseDesignMdFrontmatter(content: string): {
  frontmatter: DesignMdFrontmatter | null;
  body: string;
  malformed: boolean;
} {
  if (!/^---\r?\n/.test(content)) {
    return { frontmatter: null, body: content, malformed: false };
  }
  const lines = content.split(/\r?\n/);
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    // Opener `---` but no closer → treat as malformed
    return { frontmatter: null, body: content, malformed: true };
  }

  const fmLines = lines.slice(1, endIdx);
  let schemaVersion: number | undefined;
  let extractedAt: string | undefined;
  const sources: string[] = [];
  let inSources = false;

  for (const raw of fmLines) {
    const line = raw ?? '';
    if (/^\s+-\s+/.test(line) && inSources) {
      const m = /^\s+-\s+(.+?)\s*$/.exec(line);
      if (m?.[1]) sources.push(m[1]);
      continue;
    }
    inSources = false;
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    const value = (kv[2] ?? '').trim();
    if (key === 'schemaVersion') {
      const n = Number(value);
      if (Number.isFinite(n)) schemaVersion = n;
    } else if (key === 'extractedAt') {
      if (value) extractedAt = value;
    } else if (key === 'sources') {
      if (value === '' || value === '[]') {
        inSources = true;
      }
    }
  }

  const body = lines
    .slice(endIdx + 1)
    .join('\n')
    .replace(/^\n+/, '');

  if (typeof schemaVersion !== 'number' || typeof extractedAt !== 'string') {
    return { frontmatter: null, body, malformed: true };
  }

  return {
    frontmatter: { schemaVersion, extractedAt, sources },
    body,
    malformed: false,
  };
}

function renderConflictsSection(conflicts: TokenConflict[]): string {
  const lines: string[] = [
    'The following tokens were defined with different values across sources. First-source-wins is the current resolution; review and pick the canonical value.',
    '',
  ];
  for (const c of conflicts) {
    lines.push(`- \`${c.name}\``);
    for (const v of c.values) lines.push(`  - \`${v.value}\` (from ${v.source})`);
  }
  return lines.join('\n');
}

function renderTypeRampSection(ramp: TypeRamp): string {
  return [
    `Inferred from observed font sizes. Base unit: \`${ramp.baseUnit}px\`.`,
    '',
    `- h1: \`${ramp.h1}px\``,
    `- h2: \`${ramp.h2}px\``,
    `- h3: \`${ramp.h3}px\``,
    `- body: \`${ramp.body}px\``,
    `- small: \`${ramp.small}px\``,
  ].join('\n');
}

function renderSpacingScaleSection(scale: SpacingScale): string {
  return [
    `Inferred from observed spacing values. Base unit: \`${scale.baseUnit}px\`.`,
    '',
    `- scale: ${scale.scale.map((v) => `\`${v}px\``).join(', ')}`,
  ].join('\n');
}

function buildDesignMd(ds: StoredDesignSystem, opts: BuildDesignMdOpts): string {
  const fm = buildFrontmatter(opts, ds.extractedAt);
  const lines: string[] = [
    serializeFrontmatter(fm),
    '# Design System',
    '',
    `> ${ds.summary}`,
    `> Extracted: ${ds.extractedAt}`,
    '',
  ];
  if (ds.colors.length > 0) {
    lines.push('## Colors', '', ds.colors.map((c) => `- \`${c}\``).join('\n'), '');
  }
  if (ds.fonts.length > 0) {
    lines.push('## Fonts', '', ds.fonts.map((f) => `- \`${f}\``).join('\n'), '');
  }
  if (ds.spacing.length > 0) {
    lines.push('## Spacing', '', ds.spacing.map((s) => `- \`${s}\``).join('\n'), '');
  }
  if (ds.radius.length > 0) {
    lines.push('## Radius', '', ds.radius.map((r) => `- \`${r}\``).join('\n'), '');
  }
  if (ds.shadows.length > 0) {
    lines.push('## Shadows', '', ds.shadows.map((s) => `- \`${s}\``).join('\n'), '');
  }
  if (opts.typeRamp) {
    lines.push('## Type Ramp', '', renderTypeRampSection(opts.typeRamp), '');
  }
  if (opts.spacingScale) {
    lines.push('## Spacing Scale', '', renderSpacingScaleSection(opts.spacingScale), '');
  }
  if (opts.conflicts && opts.conflicts.length > 0) {
    lines.push('## Conflicts', '', renderConflictsSection(opts.conflicts), '');
  }
  return lines.join('\n');
}

function replaceSection(existing: string, heading: string, newContent: string): string {
  const lines = existing.split('\n');
  const headingLine = `## ${heading}`;
  const startIdx = lines.findIndex((l) => l.trim() === headingLine);

  if (startIdx === -1) {
    // Section not found — append
    return `${existing.trimEnd()}\n\n## ${heading}\n\n${newContent}\n`;
  }

  // Find the end of this section: next ## or # heading, or end of file
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^#{1,2} /.test(lines[i] ?? '')) {
      endIdx = i;
      break;
    }
  }

  const before = lines.slice(0, startIdx);
  const after = lines.slice(endIdx);
  const newSection = [`## ${heading}`, '', newContent];
  return [...before, ...newSection, '', ...after].join('\n').replace(/\n{3,}/g, '\n\n');
}

function mergeDesignMd(
  existing: string,
  ds: StoredDesignSystem,
  opts: BuildDesignMdOpts,
): { content: string; warnings: string[] } {
  const warnings: string[] = [];
  const parsed = parseDesignMdFrontmatter(existing);
  if (parsed.malformed) {
    warnings.push(
      'Existing DESIGN.md frontmatter was malformed; rewriting it with the current invocation as the sole source.',
    );
  }
  const mergeOpts: BuildDesignMdOpts = {
    ...opts,
    existingFrontmatter: parsed.frontmatter,
  };
  const fm = buildFrontmatter(mergeOpts, ds.extractedAt);

  let out = parsed.body.length > 0 ? parsed.body : existing;
  if (ds.colors.length > 0) {
    out = replaceSection(out, 'Colors', ds.colors.map((c) => `- \`${c}\``).join('\n'));
  }
  if (ds.fonts.length > 0) {
    out = replaceSection(out, 'Fonts', ds.fonts.map((f) => `- \`${f}\``).join('\n'));
  }
  if (ds.spacing.length > 0) {
    out = replaceSection(out, 'Spacing', ds.spacing.map((s) => `- \`${s}\``).join('\n'));
  }
  if (ds.radius.length > 0) {
    out = replaceSection(out, 'Radius', ds.radius.map((r) => `- \`${r}\``).join('\n'));
  }
  if (ds.shadows.length > 0) {
    out = replaceSection(out, 'Shadows', ds.shadows.map((s) => `- \`${s}\``).join('\n'));
  }
  if (opts.typeRamp) {
    out = replaceSection(out, 'Type Ramp', renderTypeRampSection(opts.typeRamp));
  }
  if (opts.spacingScale) {
    out = replaceSection(out, 'Spacing Scale', renderSpacingScaleSection(opts.spacingScale));
  }
  if (opts.conflicts && opts.conflicts.length > 0) {
    out = replaceSection(out, 'Conflicts', renderConflictsSection(opts.conflicts));
  }
  return { content: `${serializeFrontmatter(fm)}${out}`, warnings };
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

interface FetchResult {
  tokens: DesignToken[];
  sourceFiles: string[];
  warnings: string[];
}

/** URL fetcher — uses puppeteer-core (lazy-imported) to extract CSS custom
 *  properties, font families, and spacing hints from a live page. */
async function fetchFromUrl(
  value: string,
  signal: AbortSignal | undefined,
  log?: ReadBrandDeps['log'],
): Promise<FetchResult> {
  const warnings: string[] = [];
  let executablePath: string;

  // Use shared chrome-discovery (packages/shared/src/chrome-discovery.ts) so
  // we don't duplicate platform-specific path heuristics with packages/exporters.
  try {
    executablePath = await findSystemChrome();
  } catch {
    return {
      tokens: [],
      sourceFiles: [],
      warnings: [
        'System Chrome/Chromium not found. Install Chrome from https://www.google.com/chrome ' +
          'to enable live URL brand extraction. Alternatively use kind:"repo" with a local repo path.',
      ],
    };
  }

  // Lazy-import puppeteer-core — MUST NOT be at module top-level (HC #6).
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const { launch } = await import('puppeteer-core');

  const TIMEOUT_MS = 15_000;
  let browser: Awaited<ReturnType<typeof launch>> | null = null;
  try {
    browser = await launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    if (signal) {
      signal.addEventListener('abort', () => {
        void browser?.close();
      });
    }
    await page.goto(value, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });

    const rawTokens = await page.evaluate(() => {
      const tokens: Array<{ type: string; name: string; value: string }> = [];
      const style = getComputedStyle(document.documentElement);

      // CSS custom properties from :root
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules ?? [])) {
            if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
              for (const prop of Array.from(rule.style)) {
                if (prop.startsWith('--')) {
                  const val = rule.style.getPropertyValue(prop).trim();
                  if (val) tokens.push({ type: 'raw', name: prop, value: val });
                }
              }
            }
          }
        } catch {
          // Cross-origin stylesheet — skip
        }
      }

      // Font families from body + headings
      const fontEls = ['body', 'h1', 'h2', 'h3'];
      for (const sel of fontEls) {
        const el = document.querySelector(sel);
        if (el) {
          const ff = getComputedStyle(el).fontFamily;
          if (ff) tokens.push({ type: 'fontFamily', name: `font-${sel}`, value: ff });
        }
      }

      // Colors from computed body background + text
      const bodyStyle = getComputedStyle(document.body);
      const bgColor = bodyStyle.backgroundColor;
      const fgColor = bodyStyle.color;
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
        tokens.push({ type: 'color', name: 'body-bg', value: bgColor });
      }
      if (fgColor) tokens.push({ type: 'color', name: 'body-fg', value: fgColor });

      // Sample link + button colors
      const cta = document.querySelector('a[href], button');
      if (cta) {
        const ctaStyle = getComputedStyle(cta);
        if (ctaStyle.color)
          tokens.push({ type: 'color', name: 'cta-color', value: ctaStyle.color });
        if (ctaStyle.backgroundColor && ctaStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          tokens.push({ type: 'color', name: 'cta-bg', value: ctaStyle.backgroundColor });
        }
      }

      // Sample spacing from first section/main element
      const landmark = document.querySelector('main, section, header, [role="main"]');
      if (landmark) {
        const ls = getComputedStyle(landmark);
        if (ls.paddingTop)
          tokens.push({ type: 'spacing', name: 'landmark-padding-top', value: ls.paddingTop });
        if (ls.paddingLeft)
          tokens.push({ type: 'spacing', name: 'landmark-padding-left', value: ls.paddingLeft });
      }

      return tokens;
    });

    // Convert raw page data to DesignToken shape
    const designTokens: DesignToken[] = rawTokens.map((t) => ({
      schemaVersion: 1 as const,
      type: inferTokenType(t.type, t.name, t.value),
      name: t.name,
      value: t.value,
      origin: 'css-vars' as const,
    }));

    log?.info('[read_brand] url fetch complete', { url: value, tokens: designTokens.length });
    return { tokens: designTokens, sourceFiles: [value], warnings };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`URL fetch failed: ${msg}`);
    log?.warn('[read_brand] url fetch error', { url: value, error: msg });
    return { tokens: [], sourceFiles: [], warnings };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

/** Repo fetcher — clones (shallow) or uses a local path, then runs all three
 *  existing extractors against it. */
async function fetchFromRepo(
  value: string,
  signal: AbortSignal | undefined,
  log?: ReadBrandDeps['log'],
): Promise<FetchResult> {
  const { extractFromCssVars, extractFromTailwindConfig, importDtcgJson } = await import(
    '../brand/index.js'
  );
  const { promises: fsPromises, existsSync } = await import('node:fs');
  const { join, extname } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const warnings: string[] = [];

  let repoPath: string;
  let cleanupTempDir: (() => Promise<void>) | null = null;

  const isRemoteUrl =
    value.startsWith('http://') || value.startsWith('https://') || value.startsWith('git@');

  if (isRemoteUrl) {
    // Shallow clone to a temp dir
    const tempDir = join(tmpdir(), `atv-brand-${Date.now()}`);
    cleanupTempDir = async () => {
      try {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    };
    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      await execFileAsync('git', ['clone', '--depth', '1', value, tempDir], {
        timeout: 30_000,
        signal: signal ?? undefined,
      });
      repoPath = tempDir;
    } catch (err) {
      await cleanupTempDir();
      const msg = err instanceof Error ? err.message : String(err);
      return {
        tokens: [],
        sourceFiles: [],
        warnings: [`Git clone failed: ${msg}. Ensure git is installed and the URL is accessible.`],
      };
    }
  } else {
    if (!existsSync(value)) {
      return {
        tokens: [],
        sourceFiles: [],
        warnings: [`Local repo path does not exist: ${value}`],
      };
    }
    repoPath = value;
  }

  try {
    const allTokens: DesignToken[] = [];
    const sourceFiles: string[] = [];

    // Walk repo for CSS files (max 50)
    const cssFiles = await walkForFiles(repoPath, '.css', 50, fsPromises);
    for (const cssFile of cssFiles) {
      try {
        const tokens = await extractFromCssVars(cssFile);
        if (tokens.length > 0) {
          allTokens.push(...tokens);
          sourceFiles.push(cssFile);
        }
      } catch (err) {
        warnings.push(
          `CSS extraction failed for ${cssFile}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Tailwind config
    const twCandidates = [
      'tailwind.config.js',
      'tailwind.config.ts',
      'tailwind.config.mjs',
      'tailwind.config.cjs',
    ];
    for (const candidate of twCandidates) {
      const twPath = join(repoPath, candidate);
      if (existsSync(twPath)) {
        try {
          const tokens = await extractFromTailwindConfig(twPath);
          if (tokens.length > 0) {
            allTokens.push(...tokens);
            sourceFiles.push(twPath);
          }
        } catch (err) {
          warnings.push(
            `Tailwind extraction failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        break;
      }
    }

    // DTCG token JSON files
    const dtcgFiles = await walkForFiles(repoPath, '.tokens.json', 10, fsPromises);
    const tokensJson = join(repoPath, 'tokens.json');
    if (existsSync(tokensJson)) dtcgFiles.push(tokensJson);

    for (const dtcgFile of dtcgFiles) {
      try {
        const raw = await fsPromises.readFile(dtcgFile, 'utf-8');
        const json: unknown = JSON.parse(raw);
        const tokens = importDtcgJson(json, {});
        if (tokens.length > 0) {
          allTokens.push(...tokens);
          sourceFiles.push(dtcgFile);
        }
      } catch (err) {
        warnings.push(
          `DTCG import failed for ${dtcgFile}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    log?.info('[read_brand] repo scan complete', { repoPath, tokens: allTokens.length });
    return { tokens: allTokens, sourceFiles, warnings };
  } finally {
    if (cleanupTempDir) await cleanupTempDir();
  }
}

/**
 * Image fetcher — two modes:
 *  1. **Vision request** (default): `value` is a path to a screenshot. We
 *     return a structured instruction to the agent asking it to extract
 *     brand tokens with its vision capability and call `read_brand` again
 *     with the JSON-stringified token bag.
 *  2. **JSON ingest** (followup): `value` is a JSON string of the shape
 *     `{ colors: string[], fonts: string[], spacings: number[] }`. We parse
 *     it into DesignTokens and feed them through the normal synthesis
 *     pipeline.
 *
 *  Backwards-compat: an unparseable JSON-looking value falls back to the
 *  vision request stub with a warning rather than crashing.
 */
async function fetchFromImage(value: string): Promise<FetchResult> {
  const warnings: string[] = [];
  const trimmed = value.trim();

  // Mode 2: JSON ingest. Detect by leading `{` to avoid accidentally parsing
  // paths that happen to be valid JSON tokens (e.g. just a number).
  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return imageJsonToTokens(parsed as Record<string, unknown>);
      }
      warnings.push('Image JSON value was not an object; falling back to vision-extraction stub.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Image JSON parse failed (${msg}); falling back to vision-extraction stub.`);
    }
  }

  // Mode 1: vision request. Check whether the path is a real file so we can
  // tailor the agent-facing message; either way the result is text-only.
  const { existsSync } = await import('node:fs');
  const pathExists = existsSync(trimmed);
  const visionMsg = pathExists
    ? `Image-based brand extraction: an image is attached at \`${trimmed}\`. Look at the image with your vision capability, then call \`read_brand\` again with \`kind: "image"\` and \`value\` set to a JSON string of the extracted tokens, e.g. \`{"colors":["#1a73e8","#202124"],"fonts":["Inter","Helvetica"],"spacings":[4,8,16,24,32]}\`. Use raw px numbers for spacings.`
    : 'Image-based brand extraction (v1 stub): attach the image in the next user message. The agent will use its vision capability to extract brand tokens from the screenshot and then call read_brand again with kind:"image" and value set to a JSON object {"colors":[...],"fonts":[...],"spacings":[...]}.';

  return {
    tokens: [],
    sourceFiles: pathExists ? [trimmed] : [],
    warnings: [...warnings, visionMsg],
  };
}

function imageJsonToTokens(obj: Record<string, unknown>): FetchResult {
  const tokens: DesignToken[] = [];
  const colors = Array.isArray(obj['colors']) ? obj['colors'] : [];
  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    if (typeof c === 'string' && c.length > 0) {
      tokens.push({
        schemaVersion: 1,
        type: 'color',
        name: `image-color-${i}`,
        value: c,
        origin: 'manual',
      });
    }
  }
  const fonts = Array.isArray(obj['fonts']) ? obj['fonts'] : [];
  for (let i = 0; i < fonts.length; i++) {
    const f = fonts[i];
    if (typeof f === 'string' && f.length > 0) {
      tokens.push({
        schemaVersion: 1,
        type: 'fontFamily',
        name: `image-font-${i}`,
        value: f,
        origin: 'manual',
      });
    }
  }
  const spacings = Array.isArray(obj['spacings']) ? obj['spacings'] : [];
  for (let i = 0; i < spacings.length; i++) {
    const s = spacings[i];
    if (typeof s === 'number' && Number.isFinite(s)) {
      tokens.push({
        schemaVersion: 1,
        type: 'spacing',
        name: `image-spacing-${i}`,
        value: `${s}px`,
        origin: 'manual',
      });
    } else if (typeof s === 'string' && s.length > 0) {
      tokens.push({
        schemaVersion: 1,
        type: 'spacing',
        name: `image-spacing-${i}`,
        value: s,
        origin: 'manual',
      });
    }
  }
  return { tokens, sourceFiles: [], warnings: [] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type FsPromises = {
  readdir: (path: string) => Promise<string[]>;
  readFile: (path: string, encoding: 'utf-8') => Promise<string>;
  stat: (path: string) => Promise<{ isDirectory(): boolean; isFile(): boolean }>;
  writeFile: (path: string, data: string, encoding: 'utf-8') => Promise<void>;
  rm: (path: string, opts: { recursive: boolean; force: boolean }) => Promise<void>;
  mkdtemp: (prefix: string) => Promise<string>;
};

async function walkForFiles(
  dir: string,
  ext: string,
  max: number,
  fsP: FsPromises,
): Promise<string[]> {
  const results: string[] = [];
  const nodePath = await import('node:path');

  async function walk(current: string, depth: number): Promise<void> {
    if (depth > 4 || results.length >= max) return;
    let names: string[];
    try {
      names = (await fsP.readdir(current)) as string[];
    } catch {
      return;
    }
    for (const name of names) {
      if (results.length >= max) break;
      const full = nodePath.join(current, name);
      // Use stat to determine if directory or file
      try {
        const stat = await fsP.stat(full);
        if (stat.isDirectory() && !name.startsWith('.') && name !== 'node_modules') {
          await walk(full, depth + 1);
        } else if (stat.isFile() && (full.endsWith(ext) || name.endsWith(ext))) {
          results.push(full);
        }
      } catch {
        // skip inaccessible entries
      }
    }
  }

  await walk(dir, 0);
  return results;
}

function inferTokenType(rawType: string, name: string, value: string): DesignToken['type'] {
  if (rawType === 'color') return 'color';
  if (rawType === 'fontFamily') return 'fontFamily';
  if (rawType === 'spacing') return 'spacing';

  const n = name.toLowerCase();
  if (/color|palette|bg|background|foreground|fill|stroke/.test(n)) return 'color';
  if (/font-family|typeface/.test(n)) return 'fontFamily';
  if (/font-size|text-size/.test(n)) return 'fontSize';
  if (/radius|rounded/.test(n)) return 'radius';
  if (/shadow|elevation/.test(n)) return 'shadow';
  if (/spacing|space|gap|padding|margin/.test(n)) return 'spacing';

  const v = value.trim();
  if (
    /^#[0-9a-fA-F]{3,8}$/.test(v) ||
    /^rgba?\(/.test(v) ||
    /^hsla?\(/.test(v) ||
    /^oklch\(/.test(v)
  ) {
    return 'color';
  }
  if (/^\d*\.?\d+(px|rem|em|%)/.test(v)) return 'spacing';

  return 'unknown';
}

// ── Tool factory ────────────────────────────────────────────────────���─────────

export function makeReadBrandTool(
  deps: ReadBrandDeps,
): AgentTool<typeof ReadBrandParams, ReadBrandDetails> {
  return {
    name: 'read_brand',
    label: 'Read brand from external source',
    description:
      'Ingest brand identity from a live URL (kind:"url"), a Git repo URL or local repo ' +
      'path (kind:"repo"), or a screenshot image path (kind:"image"). Extracts plausible ' +
      'color tokens, type stack, and spacing scale, then writes/updates the workspace ' +
      'DESIGN.md. Use this when the user names a brand (e.g. "Stripe-style") or provides ' +
      'a reference URL/screenshot before generating designs. mergeMode defaults to "merge".',
    parameters: ReadBrandParams,
    async execute(_id, params, signal): Promise<AgentToolResult<ReadBrandDetails>> {
      const { log } = deps;
      const { source, mergeMode = 'merge' } = params;

      log?.info('[read_brand] execute', { kind: source.kind, value: source.value });

      // Fan out to the appropriate fetcher — all heavy deps lazy-imported inside.
      let result: FetchResult;
      if (source.kind === 'url') {
        result = await fetchFromUrl(source.value, signal, log);
      } else if (source.kind === 'repo') {
        result = await fetchFromRepo(source.value, signal, log);
      } else {
        result = await fetchFromImage(source.value);
      }

      const { tokens, sourceFiles, warnings } = result;

      // Synthesize into StoredDesignSystem
      const ds = synthesizeBrand(tokens, {
        sourceValue: source.value,
        workspacePath: deps.workspacePath,
        sourceFiles,
      });

      // Slice 2.2 — within-invocation conflict detection (informational only).
      const conflicts = detectTokenConflicts(tokens);
      // Slice 2.3 / 2.4 — type ramp and spacing scale inference.
      const typeRamp = inferTypeRamp(extractFontSizesPx(tokens));
      const spacingScale = inferSpacingScale(extractSpacingsPx(tokens));

      let designMdPath: string | null = null;

      // Write DESIGN.md if workspace + fs deps are available
      if (deps.workspacePath && deps.fs) {
        const { join } = await import('node:path');
        const mdPath = join(deps.workspacePath, 'DESIGN.md');
        designMdPath = mdPath;

        try {
          let content: string;
          const buildOpts: BuildDesignMdOpts = {
            source: { kind: source.kind, value: source.value },
            conflicts,
            typeRamp,
            spacingScale,
          };
          const exists = await deps.fs.exists(mdPath);
          if (!exists || mergeMode === 'replace') {
            content = buildDesignMd(ds, buildOpts);
          } else {
            const existing = await deps.fs.readFile(mdPath);
            const merged = mergeDesignMd(existing, ds, buildOpts);
            content = merged.content;
            for (const w of merged.warnings) warnings.push(w);
          }
          await deps.fs.writeFile(mdPath, content);
          log?.info('[read_brand] DESIGN.md written', { path: mdPath, mode: mergeMode });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          warnings.push(`Failed to write DESIGN.md: ${msg}`);
          log?.error('[read_brand] DESIGN.md write failed', { error: msg });
          designMdPath = null;
        }
      }

      // Build human-readable summary
      const lines: string[] = [
        '## Brand ingest complete',
        `Source: ${source.kind} — ${source.value}`,
        '',
        `**Tokens extracted:** ${tokens.length} total`,
        `- Colors: ${ds.colors.length}${ds.colors.length > 0 ? ` — ${ds.colors.slice(0, 6).join(', ')}${ds.colors.length > 6 ? '…' : ''}` : ''}`,
        `- Fonts: ${ds.fonts.length}${ds.fonts.length > 0 ? ` — ${ds.fonts.slice(0, 4).join(', ')}${ds.fonts.length > 4 ? '…' : ''}` : ''}`,
        `- Spacing: ${ds.spacing.length}`,
        `- Radius: ${ds.radius.length}`,
        `- Shadows: ${ds.shadows.length}`,
        '',
      ];

      if (conflicts.length > 0) {
        lines.push(
          `**Conflicts:** ${conflicts.length} token name${conflicts.length === 1 ? '' : 's'} defined with different values — see Conflicts section in DESIGN.md.`,
          '',
        );
      }

      if (designMdPath) {
        lines.push(`**DESIGN.md updated** at \`${designMdPath}\` (mode: ${mergeMode})`);
        lines.push('The design system is now available via `read_design_system`.');
      } else if (deps.workspacePath && deps.fs) {
        lines.push('DESIGN.md write failed — see warnings.');
      } else {
        lines.push('No workspace path provided — tokens extracted but DESIGN.md not written.');
      }

      if (warnings.length > 0) {
        lines.push('', '**Warnings:**');
        for (const w of warnings) lines.push(`- ${w}`);
      }

      const details: ReadBrandDetails = {
        source: { kind: source.kind, value: source.value },
        colorsFound: ds.colors.length,
        fontsFound: ds.fonts.length,
        spacingFound: ds.spacing.length,
        designMdPath,
        warnings,
      };

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details,
      };
    },
  };
}
