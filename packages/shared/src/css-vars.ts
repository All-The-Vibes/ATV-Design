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
 * block in a source string (raw CSS or a full HTML document), including a
 * `:root` nested inside a conditional-group at-rule (`@media`/`@supports`/
 * `@layer`/`@container`) — the canonical dark-mode / responsive token pattern.
 * The runtime's static-tweak bridge turns the result into live `setProperty`
 * updates, and TweakPanel can render controls for them — giving static artifacts
 * the same tweak affordance scripted ones get from TWEAK_DEFAULTS.
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
 * Defense-in-depth cap on the input the extractor will scan. The scan is O(n),
 * but this runs synchronously in the Electron main process on untrusted,
 * model-generated artifact HTML, so bound the work regardless. A design's token
 * `:root` declarations live near the top of the document, so an artifact larger
 * than this almost certainly carries its design tokens within the first slice;
 * scanning beyond it yields diminishing returns for real inputs while removing
 * any pathological-size freeze. ~1 MB of leading source.
 */
const MAX_SCAN_LENGTH = 1_000_000;

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
 * ONE forward pass, O(n) in `source.length` and independent of the number of
 * `:root` occurrences. String/comment state is carried across the whole scan,
 * and the `:root`→`{` selector gap is consumed IN the same pass (no per-match
 * `indexOf`/`slice` rescan — that would be O(n²) on pathological input like
 * `:root :root :root …` with a distant/absent brace). Each character is visited
 * a bounded number of times. This runs synchronously in the Electron main
 * process on model-generated artifact HTML, so it must not be super-linear.
 *
 * Model: track the selector currently being scanned (the text since the last
 * top-level `{`/`}`). When a `{` opens a block:
 *   - if the selector contains a top-level `:root` token → parse it as a :root
 *     block;
 *   - else if the selector is a conditional-group at-rule prelude
 *     (`@media`/`@supports`/`@layer`/`@container`/`@scope`) → DESCEND into the
 *     body (keep scanning inside it) so a nested `:root` — the canonical
 *     dark-mode / responsive pattern — is still found;
 *   - else → skip the whole block (an ordinary style rule or a declaration
 *     at-rule like `@font-face`/`@keyframes`).
 */
const GROUP_AT_RULE = /@(?:media|supports|layer|container|scope)\b/i;
export function extractRootCssVars(source: string): RootCssVars {
  const out: RootCssVars = {};
  if (!source) return out;

  // Bound the scan (defense-in-depth on the untrusted main-process path).
  const scan = source.length > MAX_SCAN_LENGTH ? source.slice(0, MAX_SCAN_LENGTH) : source;
  const n = scan.length;
  let i = 0;
  let inStr: '"' | "'" | null = null;
  let inComment = false;
  // Does the selector we are currently accumulating contain a `:root` token?
  let selectorHasRoot = false;
  // Start index of the current selector/at-rule prelude (reset after each
  // top-level `{`/`}`), so a `{` can inspect its prelude for a group at-rule.
  let selectorStart = 0;

  while (i < n) {
    const ch = scan[i];

    if (inComment) {
      if (ch === '*' && scan[i + 1] === '/') {
        inComment = false;
        i += 2;
      } else {
        i += 1;
      }
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
    if (ch === '/' && scan[i + 1] === '*') {
      inComment = true;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      i += 1;
      continue;
    }

    if (ch === '{') {
      if (selectorHasRoot) {
        const endIdx = findBlockEnd(scan, i);
        if (endIdx > i) {
          parseRootBody(scan.slice(i + 1, endIdx), out);
          i = endIdx + 1;
        } else {
          // Unbalanced/truncated — parse what we can to the end, then stop.
          parseRootBody(scan.slice(i + 1), out);
          break;
        }
        selectorHasRoot = false;
        selectorStart = i;
        continue;
      }
      // Not a :root rule. If the prelude is a conditional-group at-rule, DESCEND
      // into its body (a nested :root may live inside); otherwise skip the block.
      const prelude = scan.slice(selectorStart, i);
      if (GROUP_AT_RULE.test(prelude)) {
        // Enter the body: just step past `{` and keep scanning; the matching `}`
        // is handled by the `}` branch, which resets the selector context.
        i += 1;
        selectorStart = i;
        continue;
      }
      const endIdx = findBlockEnd(scan, i);
      i = endIdx > i ? endIdx + 1 : n;
      selectorStart = i;
      continue;
    }
    if (ch === '}') {
      // Close of a descended group body (or a stray `}`): reset selector context.
      selectorHasRoot = false;
      i += 1;
      selectorStart = i;
      continue;
    }

    // Top-level `:root` token (word-bounded so `:rootish` does not match).
    if (ch === ':' && scan.startsWith(':root', i) && !isWordChar(scan[i + 5])) {
      selectorHasRoot = true;
      i += 5;
      continue;
    }

    i += 1;
  }
  return out;
}

/** CSS identifier char (so `:root` is not matched inside `:rootish`). */
function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\w-]/.test(ch);
}
