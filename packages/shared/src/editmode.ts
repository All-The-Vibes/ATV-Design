/**
 * EDITMODE marker block — extract & rewrite the agent-declared `TWEAK_DEFAULTS`
 * JSON object embedded inside an artifact source.
 *
 * Preferred format (matches agent.ts AGENTIC_TOOL_GUIDANCE Output format):
 *
 *   const TWEAK_DEFAULTS = /\* EDITMODE-BEGIN *\/{ "key": "value" }/\* EDITMODE-END *\/;
 *
 * Fallback format (auto-recovered when the agent forgot the markers):
 *
 *   const TWEAK_DEFAULTS = { "key": "value" };
 *
 * `ensureEditmodeMarkers` rewrites a bare-const artifact in-place so downstream
 * consumers (postMessage bridge, replace flows) only see the canonical form.
 *
 * Whitespace between the markers is preserved on round-trip; the parser
 * treats the inner span as a JSON literal (object).
 *
 * Trust model: the inner JSON comes from model output. We `JSON.parse` it
 * inside a try/catch and return null on failure rather than throwing, so a
 * malformed block degrades to "no tweak panel" instead of crashing the
 * preview pipeline. The bare-const fallback uses a brace-balanced scan, NOT
 * `eval` / `new Function`, so a hostile literal cannot execute in the host.
 */

const EDITMODE_RE = /\/\*\s*EDITMODE-BEGIN\s*\*\/([\s\S]*?)\/\*\s*EDITMODE-END\s*\*\//;
const BARE_TWEAK_DEFAULTS_RE = /const\s+TWEAK_DEFAULTS\s*=\s*/;
const TWEAK_SCHEMA_RE = /\/\*\s*TWEAK-SCHEMA-BEGIN\s*\*\/([\s\S]*?)\/\*\s*TWEAK-SCHEMA-END\s*\*\//;

export interface EditmodeBlock {
  tokens: Record<string, unknown>;
  /** Raw inner span (between the markers) — useful for diagnostics. */
  raw: string;
  /** `marked` = canonical EDITMODE markers; `inferred` = bare const fallback. */
  source: 'marked' | 'inferred';
}

interface BareLocation {
  /** Index of the opening `{` of the object literal. */
  objStart: number;
  /** Index just past the closing `}` of the object literal. */
  objEnd: number;
  /** The object literal text including braces. */
  literal: string;
}

function findBalancedBraceEnd(source: string, openIdx: number): number {
  if (source[openIdx] !== '{') return -1;
  let depth = 0;
  let inStr: '"' | "'" | '`' | null = null;
  let escaped = false;
  for (let i = openIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inStr) {
      if (ch === '\\') escaped = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function findBareTweakDefaults(source: string): BareLocation | null {
  const m = BARE_TWEAK_DEFAULTS_RE.exec(source);
  if (!m) return null;
  const objStart = m.index + m[0].length;
  if (source[objStart] !== '{') return null;
  const objEnd = findBalancedBraceEnd(source, objStart);
  if (objEnd < 0) return null;
  return { objStart, objEnd, literal: source.slice(objStart, objEnd) };
}

export function parseEditmodeBlock(source: string): EditmodeBlock | null {
  const match = EDITMODE_RE.exec(source);
  if (match) {
    const raw = (match[1] ?? '').trim();
    if (raw.length === 0) return { tokens: {}, raw, source: 'marked' };
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      return { tokens: parsed as Record<string, unknown>, raw, source: 'marked' };
    } catch {
      return null;
    }
  }

  const bare = findBareTweakDefaults(source);
  if (!bare) return null;
  try {
    const parsed = JSON.parse(bare.literal) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return { tokens: parsed as Record<string, unknown>, raw: bare.literal, source: 'inferred' };
  } catch {
    return null;
  }
}

export function replaceEditmodeBlock(source: string, newTokens: Record<string, unknown>): string {
  const json = JSON.stringify(newTokens, null, 2);
  if (EDITMODE_RE.test(source)) {
    return source.replace(EDITMODE_RE, `/*EDITMODE-BEGIN*/${json}/*EDITMODE-END*/`);
  }
  const bare = findBareTweakDefaults(source);
  if (!bare) return source;
  return `${source.slice(0, bare.objStart)}/*EDITMODE-BEGIN*/${json}/*EDITMODE-END*/${source.slice(bare.objEnd)}`;
}

/**
 * Normalize a bare `const TWEAK_DEFAULTS = {...};` declaration into the
 * canonical marker form, in-place. Returns the source unchanged when markers
 * are already present (or when no parseable bare const exists). The marker
 * form is what the in-iframe postMessage bridge looks for, so wrapping at
 * srcdoc-build time means live tweak updates work even on agent output that
 * forgot the markers.
 */
export function ensureEditmodeMarkers(source: string): string {
  if (EDITMODE_RE.test(source)) return source;
  const bare = findBareTweakDefaults(source);
  if (!bare) return source;
  return `${source.slice(0, bare.objStart)}/*EDITMODE-BEGIN*/${bare.literal}/*EDITMODE-END*/${source.slice(bare.objEnd)}`;
}

// ---------------------------------------------------------------------------
// TWEAK_SCHEMA — agent-declared UI hints for each token in TWEAK_DEFAULTS.
//
// The agent emits a parallel marker block alongside TWEAK_DEFAULTS:
//
//   const TWEAK_SCHEMA = /\* TWEAK-SCHEMA-BEGIN *\/{
//     accentColor: { kind: "color" },
//     radius: { kind: "number", min: 0, max: 32, step: 2, unit: "px" }
//   }/\* TWEAK-SCHEMA-END *\/;
//
// TweakPanel consumes the schema to pick precise controls (real range slider
// for numbers, segmented picker for enums, etc). Schema is *advisory*: any
// missing entry falls back to the existing heuristic in TweakPanel.
//
// Trust model mirrors TWEAK_DEFAULTS: JSON-only, parsed inside try/catch,
// invalid blocks degrade silently.
// ---------------------------------------------------------------------------

export type TokenSchemaEntry =
  | { kind: 'color' }
  | { kind: 'number'; min?: number; max?: number; step?: number; unit?: string }
  | { kind: 'enum'; options: string[] }
  | { kind: 'boolean' }
  | { kind: 'string'; placeholder?: string };

export type TweakSchema = Record<string, TokenSchemaEntry>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateEntry(value: unknown): TokenSchemaEntry | null {
  if (!isPlainObject(value)) return null;
  const kind = value['kind'];
  if (kind === 'color' || kind === 'boolean') {
    return { kind };
  }
  if (kind === 'number') {
    const out: TokenSchemaEntry = { kind: 'number' };
    if (typeof value['min'] === 'number') out.min = value['min'];
    if (typeof value['max'] === 'number') out.max = value['max'];
    if (typeof value['step'] === 'number') out.step = value['step'];
    if (typeof value['unit'] === 'string') out.unit = value['unit'];
    return out;
  }
  if (kind === 'enum') {
    const options = value['options'];
    if (!Array.isArray(options)) return null;
    const opts = options.filter((o): o is string => typeof o === 'string');
    if (opts.length === 0) return null;
    return { kind: 'enum', options: opts };
  }
  if (kind === 'string') {
    const out: TokenSchemaEntry = { kind: 'string' };
    if (typeof value['placeholder'] === 'string') out.placeholder = value['placeholder'];
    return out;
  }
  return null;
}

export function parseTweakSchema(source: string): TweakSchema | null {
  const match = TWEAK_SCHEMA_RE.exec(source);
  if (!match) return null;
  const raw = (match[1] ?? '').trim();
  if (raw.length === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) return null;
  const out: TweakSchema = {};
  for (const [key, entry] of Object.entries(parsed)) {
    const validated = validateEntry(entry);
    if (validated) out[key] = validated;
  }
  return out;
}

/**
 * Replace (or insert) the TWEAK_SCHEMA block in `source`.
 *
 *   - If `/\* TWEAK-SCHEMA-BEGIN *\/...END` already exists → swap the inner JSON.
 *   - Else if the source has a TWEAK_DEFAULTS line (marked or bare) → insert
 *     a new `const TWEAK_SCHEMA = /\* ... *\/;` line right after it.
 *   - Else → return source unchanged. Caller is responsible for ensuring the
 *     artifact has a TWEAK_DEFAULTS block first.
 */
export function replaceTweakSchema(source: string, schema: TweakSchema): string {
  const json = JSON.stringify(schema, null, 2);
  if (TWEAK_SCHEMA_RE.test(source)) {
    return source.replace(TWEAK_SCHEMA_RE, `/*TWEAK-SCHEMA-BEGIN*/${json}/*TWEAK-SCHEMA-END*/`);
  }
  const marked = EDITMODE_RE.exec(source);
  if (marked) {
    // Find the end of the statement containing the EDITMODE block (next ';').
    const editEnd = marked.index + marked[0].length;
    const semi = source.indexOf(';', editEnd);
    const insertAt = semi >= 0 ? semi + 1 : editEnd;
    const block = `\nconst TWEAK_SCHEMA = /*TWEAK-SCHEMA-BEGIN*/${json}/*TWEAK-SCHEMA-END*/;`;
    return `${source.slice(0, insertAt)}${block}${source.slice(insertAt)}`;
  }
  const bare = findBareTweakDefaults(source);
  if (bare) {
    const semi = source.indexOf(';', bare.objEnd);
    const insertAt = semi >= 0 ? semi + 1 : bare.objEnd;
    const block = `\nconst TWEAK_SCHEMA = /*TWEAK-SCHEMA-BEGIN*/${json}/*TWEAK-SCHEMA-END*/;`;
    return `${source.slice(0, insertAt)}${block}${source.slice(insertAt)}`;
  }
  return source;
}
