/// <reference lib="dom" />
/**
 * capture_element — agent-side tool that fetches a single live DOM element
 * from an external URL via system Chrome. Returns a PNG screenshot path,
 * the element's outer HTML, its computed-style tokens, or all three.
 *
 * Companion to `read_brand`: where `read_brand` ingests the whole site as
 * a brand system, `capture_element` lets the agent pin a specific component
 * (a pricing card, a nav bar, a button) and reason about its visual and
 * structural details. Saves bitmaps to the workspace (HC #4) so the model
 * sees a path instead of a base64 blob (avoids prompt bloat).
 *
 * Heavy deps (puppeteer-core, node:crypto, node:fs/promises) are lazy-imported
 * inside execute() — they MUST NOT appear at module top-level (HC #6).
 *
 * Chrome discovery is shared with `read_brand` and exporters via
 * `@atv-design/shared`'s `findSystemChrome` (HC #1 — no bundled Chromium).
 *
 * NOTE: the triple-slash above includes the DOM lib for type-checking the
 * page.evaluate(() => {...}) callback below (it executes in the browser).
 * Lib is file-scoped — does not affect any other module's lib resolution.
 */

import { findSystemChrome } from '@atv-design/shared/node';
import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import { Type } from '@sinclair/typebox';

// ── Params ────────────────────────────────────────────────────────────────────

const CaptureElementParams = Type.Object({
  url: Type.String({ minLength: 1 }),
  selector: Type.String({ minLength: 1 }),
  format: Type.Union([
    Type.Literal('png'),
    Type.Literal('dom'),
    Type.Literal('styles'),
    Type.Literal('all'),
  ]),
});

// ── Public types ──────────────────────────────────────────────────────────────

export interface CaptureElementResult {
  pngPath?: string;
  dom?: string;
  styles?: Record<string, string>;
}

export interface CaptureElementDetails {
  ok: boolean;
  error?: string;
  result?: CaptureElementResult;
  warnings: string[];
}

export interface CaptureElementFs {
  /** Create (recursively) the parent directories for the capture. */
  mkdir: (path: string, opts: { recursive: boolean }) => Promise<unknown>;
  /** Write the PNG bytes to disk. */
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
}

export interface CaptureElementDeps {
  /** Workspace root for the active design. PNGs are saved here. */
  workspacePath: string | null;
  /**
   * Optional design subfolder under the workspace. When provided, the
   * capture path is `<workspacePath>/<designId>/assets/captures/...`;
   * when null, it falls back to `<workspacePath>/assets/captures/...` so
   * the tool works with the current agent wiring (which has no per-session
   * design id available yet).
   */
  designId: string | null;
  /**
   * Optional filesystem implementation. When omitted, the tool uses
   * `node:fs/promises` directly. Tests inject a fake to avoid disk I/O.
   */
  fs?: CaptureElementFs | undefined;
  /** Project logger — never use console.* per CLAUDE.md constraint. */
  log?:
    | {
        info: (event: string, data?: Record<string, unknown>) => void;
        warn: (event: string, data?: Record<string, unknown>) => void;
        error: (event: string, data?: Record<string, unknown>) => void;
      }
    | undefined;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Computed-style properties returned for `format: 'styles' | 'all'`. */
const COMPUTED_STYLE_KEYS = [
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'padding',
  'margin',
  'border-radius',
  'border',
  'box-shadow',
  'display',
  'gap',
] as const;

/** Max bytes of outerHTML returned for `format: 'dom' | 'all'`. */
const DOM_TRUNCATION_BYTES = 32 * 1024;

const NAVIGATE_TIMEOUT_MS = 15_000;
const SELECTOR_TIMEOUT_MS = 5_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isHttpUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function truncateDom(html: string): string {
  // Trimmed via UTF-8 byte length so we don't half-split a surrogate pair.
  const bytes = Buffer.byteLength(html, 'utf-8');
  if (bytes <= DOM_TRUNCATION_BYTES) return html;
  const marker = ' ... [truncated]';
  const buf = Buffer.from(html, 'utf-8').subarray(
    0,
    DOM_TRUNCATION_BYTES - Buffer.byteLength(marker, 'utf-8'),
  );
  return `${buf.toString('utf-8')}${marker}`;
}

/** Build the on-disk PNG path and the workspace-relative path returned to the model. */
function buildCapturePaths(
  workspacePath: string,
  designId: string | null,
  hash: string,
  joinFn: (...parts: string[]) => string,
): { absPath: string; relPath: string; dirAbsPath: string } {
  const segments = designId ? [designId, 'assets', 'captures'] : ['assets', 'captures'];
  const dirAbsPath = joinFn(workspacePath, ...segments);
  const absPath = joinFn(dirAbsPath, `${hash}.png`);
  // Forward-slash relative path is the host's canonical form for asset refs
  // (matches generate_image_asset). Convert backslashes for Windows safety.
  const relPath = [...segments, `${hash}.png`].join('/').replace(/\\/g, '/');
  return { absPath, relPath, dirAbsPath };
}

async function sha1Hex(input: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha1').update(input).digest('hex');
}

// ── Tool factory ──────────────────────────────────────────────────────────────

export function makeCaptureElementTool(
  deps: CaptureElementDeps,
): AgentTool<typeof CaptureElementParams, CaptureElementDetails> {
  return {
    name: 'capture_element',
    label: 'Capture element from external URL',
    description:
      'Fetch a single live DOM element from an external URL via system Chrome. ' +
      'Returns a PNG screenshot path ("png"), the element outerHTML ("dom"), ' +
      'its curated computed styles ("styles"), or all three ("all"). ' +
      'Use this when you need to study a specific component (a pricing card, a ' +
      'nav bar, a button) before designing your own. URL must be http or https. ' +
      'PNGs land under <workspace>/assets/captures/<hash>.png so the model gets a ' +
      'path, not a base64 blob.',
    parameters: CaptureElementParams,
    async execute(_id, params, signal): Promise<AgentToolResult<CaptureElementDetails>> {
      const { url, selector, format } = params;
      const log = deps.log;
      const warnings: string[] = [];

      log?.info('[capture_element] execute', { url, selector, format });

      // 1. URL scheme guard — reject before launching Chrome.
      if (!isHttpUrl(url)) {
        return errorResult(`URL must use http or https. Got: ${url}`, warnings);
      }

      // 2. PNG output requires a workspace path — single-element screenshots
      //    are still large enough (often 20–200 KB) that returning base64
      //    would bloat the agent's context window. HC #4 says the workspace
      //    is the source of truth for assets, so we refuse cleanly instead.
      const needsPngOutput = format === 'png' || format === 'all';
      if (needsPngOutput && !deps.workspacePath) {
        return errorResult(
          'capture_element with format "png"/"all" requires a workspace. ' +
            'Open or create a design first, or call with format "dom" / "styles".',
          warnings,
        );
      }

      // 3. Locate system Chrome. Returning a warning result here (not a throw)
      //    lets the agent fall back to other tools without a hard failure.
      let executablePath: string;
      try {
        executablePath = await findSystemChrome();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const warning =
          'System Chrome/Chromium not found. Install Chrome from ' +
          'https://www.google.com/chrome to enable live element capture.';
        warnings.push(warning);
        log?.warn('[capture_element] chrome discovery failed', { error: msg });
        return errorResult(warning, warnings);
      }

      // 4. Lazy-import puppeteer-core. MUST NOT appear at module top-level (HC #6).
      const { launch } = await import('puppeteer-core');

      let browser: Awaited<ReturnType<typeof launch>> | null = null;
      try {
        browser = await launch({
          executablePath,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        if (signal) {
          signal.addEventListener('abort', () => {
            void browser?.close();
          });
        }

        const page = await browser.newPage();

        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: NAVIGATE_TIMEOUT_MS });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return errorResult(`Page navigation to ${url} failed or timed out: ${msg}`, warnings);
        }

        let elementHandle: Awaited<ReturnType<typeof page.waitForSelector>>;
        try {
          elementHandle = await page.waitForSelector(selector, { timeout: SELECTOR_TIMEOUT_MS });
        } catch {
          return errorResult(
            `Selector "${selector}" not found on ${url} within ${SELECTOR_TIMEOUT_MS}ms.`,
            warnings,
          );
        }
        if (!elementHandle) {
          return errorResult(`Selector "${selector}" matched no element on ${url}.`, warnings);
        }

        const result: CaptureElementResult = {};

        if (format === 'png' || format === 'all') {
          // workspacePath is non-null here (checked above) — `deps.workspacePath!`
          // would lint-warn so we narrow via local const.
          const workspacePath = deps.workspacePath;
          if (workspacePath !== null) {
            const screenshot = await elementHandle.screenshot({ type: 'png' });
            // puppeteer's typing returns `Uint8Array` in v24+, but historically
            // `Buffer`. Coerce defensively.
            const pngBytes =
              screenshot instanceof Uint8Array ? screenshot : Buffer.from(String(screenshot));

            const hash = (await sha1Hex(`${url}::${selector}`)).slice(0, 16);
            const { join } = await import('node:path');
            const { absPath, relPath, dirAbsPath } = buildCapturePaths(
              workspacePath,
              deps.designId,
              hash,
              join,
            );

            const fs =
              deps.fs ??
              (await (async () => {
                const { mkdir, writeFile } = await import('node:fs/promises');
                return {
                  mkdir: (p: string, opts: { recursive: boolean }) => mkdir(p, opts),
                  writeFile: (p: string, data: Uint8Array) => writeFile(p, data),
                };
              })());

            await fs.mkdir(dirAbsPath, { recursive: true });
            await fs.writeFile(absPath, pngBytes);
            log?.info('[capture_element] png written', {
              path: absPath,
              bytes: pngBytes.byteLength,
            });
            result.pngPath = relPath;
          }
        }

        if (format === 'dom' || format === 'all') {
          const outerHtml = await page.evaluate((el) => (el as Element).outerHTML, elementHandle);
          result.dom = truncateDom(outerHtml);
        }

        if (format === 'styles' || format === 'all') {
          const styles = await page.evaluate(
            (el, keys) => {
              const cs = getComputedStyle(el as Element);
              const out: Record<string, string> = {};
              for (const k of keys) {
                const v = cs.getPropertyValue(k);
                if (v && v.trim().length > 0) out[k] = v.trim();
              }
              return out;
            },
            elementHandle,
            COMPUTED_STYLE_KEYS as unknown as string[],
          );
          result.styles = styles;
        }

        return okResult(result, warnings, { url, selector, format });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log?.error('[capture_element] unexpected error', { error: msg });
        return errorResult(`capture_element failed: ${msg}`, warnings);
      } finally {
        await browser?.close().catch(() => undefined);
      }
    },
  };
}

// ── Result helpers ────────────────────────────────────────────────────────────

function errorResult(error: string, warnings: string[]): AgentToolResult<CaptureElementDetails> {
  const lines: string[] = [`capture_element: error — ${error}`];
  if (warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const w of warnings) lines.push(`- ${w}`);
  }
  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    details: { ok: false, error, warnings },
  };
}

function okResult(
  result: CaptureElementResult,
  warnings: string[],
  ctx: { url: string; selector: string; format: string },
): AgentToolResult<CaptureElementDetails> {
  const lines: string[] = [
    `capture_element: ok — captured \`${ctx.selector}\` from ${ctx.url} (format: ${ctx.format})`,
  ];
  if (result.pngPath) lines.push(`PNG path: ${result.pngPath}`);
  if (result.dom !== undefined) {
    const bytes = Buffer.byteLength(result.dom, 'utf-8');
    lines.push(`DOM: ${bytes} bytes${bytes >= DOM_TRUNCATION_BYTES ? ' (truncated)' : ''}`);
  }
  if (result.styles) {
    const entries = Object.entries(result.styles);
    lines.push(`Computed styles (${entries.length} keys):`);
    for (const [k, v] of entries) lines.push(`  ${k}: ${v}`);
  }
  if (warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const w of warnings) lines.push(`- ${w}`);
  }
  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    details: { ok: true, result, warnings },
  };
}
