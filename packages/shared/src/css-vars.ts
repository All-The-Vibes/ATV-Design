/**
 * Extract tweakable CSS custom properties from `:root` blocks.
 *
 * Static (script-less) artifacts — e.g. a pure HTML/CSS mockup the model
 * produced for an onboarding visual — carry no `TWEAK_DEFAULTS` block, so the
 * EDITMODE / TweakPanel path has nothing to bind. But they almost always
 * declare a design-token system as `:root { --color-accent: …; --radius: … }`.
 * Those custom properties ARE the tweakable surface for a static artifact.
 *
 * This parser pulls the declared `--name: value` pairs out of every `:root`
 * block in a source string (raw CSS or a full HTML document). The runtime's
 * static-tweak bridge turns the result into live `setProperty` updates, and
 * TweakPanel can render controls for them — giving static artifacts the same
 * tweak affordance scripted ones get from TWEAK_DEFAULTS.
 *
 * Trust model: pure string scanning, no `eval`, no DOM, no regex backtracking
 * on untrusted input. A SINGLE linear forward pass over `source` (O(n) in its
 * length, independent of the number of `:root` blocks) — safe to run
 * synchronously on model-generated artifact HTML. Malformed input (missing
 * closing brace, stray colons) degrades to "fewer/zero tokens", never throws — a
 * broken artifact must not crash the preview pipeline.
 */

/** Map of `--custom-property` name → declared value (both trimmed). */
export type RootCssVars = Record<string, string>;

/**
 * Find the index just past the matching `}` for the block opened at `openIdx`
 * (which must point at `{`). Brace-depth aware, and skips braces that sit
 * inside string values (`"…}…"`, `'…}…'`) or CSS comments (`/* … }* /`) so a
 * token like `--quote: "}"` does not prematurely close the block. Returns -1 if
 * unbalanced.
 */
function findBlockEnd(source: string, openIdx: number): number {
  let depth = 0;
  let inStr: '"' | "'" | null = null;
  let inComment = false;
  for (let i = openIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (inComment) {
      if (ch === '*' && source[i + 1] === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (inStr) {
      if (ch === '\\') {
        i += 1; // skip escaped char
      } else if (ch === inStr) {
        inStr = null;
      }
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Split a CSS declaration body into top-level `;`-separated declarations,
 * ignoring semicolons nested inside parentheses (e.g. inside `rgba(...)` or a
 * `url(...)` with a query string) or inside string values, so values are not
 * split mid-function or mid-string.
 */
function splitTopLevelDeclarations(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr: '"' | "'" | null = null;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (inStr) {
      if (ch === '\\') i += 1;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") inStr = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) {
      out.push(body.slice(start, i));
      start = i + 1;
    }
  }
  if (start < body.length) out.push(body.slice(start));
  return out;
}

/**
 * Parse a single `:root { … }` declaration body into custom-property pairs.
 * Only `--*` declarations are kept; ordinary properties (color, font-size, …)
 * are ignored. The value is split on the FIRST colon so values that themselves
 * contain colons (urls, data URIs) survive intact.
 */
function parseRootBody(body: string, into: RootCssVars): void {
  for (const decl of splitTopLevelDeclarations(body)) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const name = decl.slice(0, colon).trim();
    if (!name.startsWith('--')) continue;
    const value = decl.slice(colon + 1).trim();
    if (value.length === 0) continue;
    into[name] = value;
  }
}

/**
 * Extract all `:root`-declared custom properties from `source` (raw CSS or an
 * HTML document with inline `<style>`). Later declarations win on conflict,
 * matching the CSS cascade for same-specificity `:root` rules. Returns an empty
 * object when no tweakable vars are present.
 *
 * Single forward pass: string/comment state is carried across the whole scan, so
 * a `:root` that lives inside a string/comment is skipped without rescanning
 * from the start. This keeps the extractor linear in `source.length` regardless
 * of how many `:root` blocks it contains (a per-match rescan would be O(n²), and
 * this runs synchronously in the Electron main process on model-generated HTML).
 */
export function extractRootCssVars(source: string): RootCssVars {
  const out: RootCssVars = {};
  if (!source) return out;

  const n = source.length;
  let i = 0;
  let inStr: '"' | "'" | null = null;
  let inComment = false;

  while (i < n) {
    const ch = source[i];

    if (inComment) {
      if (ch === '*' && source[i + 1] === '/') {
        inComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (inStr) {
      if (ch === '\\') i += 2;
      else if (ch === inStr) {
        inStr = null;
        i += 1;
      } else i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      inComment = true;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      i += 1;
      continue;
    }

    // Real (non-string, non-comment) `:root` selector? Match `:root\b[^{]*\{`
    // starting here without a global regex rescan.
    if (ch === ':' && source.startsWith(':root', i) && !isWordChar(source[i + 5])) {
      const braceIdx = source.indexOf('{', i + 5);
      // Guard: the gap between `:root` and `{` must not contain another `{` or a
      // `}` (that would mean this `:root` had no block of its own).
      if (braceIdx !== -1 && source.slice(i + 5, braceIdx).indexOf('}') === -1) {
        const endIdx = findBlockEnd(source, braceIdx);
        if (endIdx > braceIdx) {
          parseRootBody(source.slice(braceIdx + 1, endIdx), out);
          i = endIdx + 1;
          continue;
        }
        // Unbalanced/truncated — parse what we can to the end, then stop.
        parseRootBody(source.slice(braceIdx + 1), out);
        break;
      }
    }
    i += 1;
  }
  return out;
}

/** CSS identifier char (so `:root` is not matched inside `:rootish`). */
function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\w-]/.test(ch);
}
