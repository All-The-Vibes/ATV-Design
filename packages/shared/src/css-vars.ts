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
 * on untrusted input (linear scan). Malformed input (missing closing brace,
 * stray colons) degrades to "fewer/zero tokens", never throws — a broken
 * artifact must not crash the preview pipeline.
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
 * True when `idx` falls inside a CSS string (`"…"`/`'…'`) or comment (`/* … *\/`)
 * given a linear scan from the start of `source`. Used to reject a `:root`
 * substring that lives inside another rule's string value (e.g.
 * `content: ":root{…}"`) rather than being a real selector.
 */
function isInsideStringOrComment(source: string, idx: number): boolean {
  let inStr: '"' | "'" | null = null;
  let inComment = false;
  for (let i = 0; i < idx && i < source.length; i += 1) {
    const ch = source[i];
    if (inComment) {
      if (ch === '*' && source[i + 1] === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (inStr) {
      if (ch === '\\') i += 1;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      inComment = true;
      i += 1;
    } else if (ch === '"' || ch === "'") {
      inStr = ch;
    }
  }
  return inStr !== null || inComment;
}

/**
 * Extract all `:root`-declared custom properties from `source` (raw CSS or an
 * HTML document with inline `<style>`). Later declarations win on conflict,
 * matching the CSS cascade for same-specificity `:root` rules. Returns an empty
 * object when no tweakable vars are present.
 */
export function extractRootCssVars(source: string): RootCssVars {
  const out: RootCssVars = {};
  if (!source) return out;
  // Scan for each `:root` selector, then parse the block that follows it.
  const rootRe = /:root\b[^{]*\{/g;
  let match: RegExpExecArray | null = rootRe.exec(source);
  while (match !== null) {
    // Reject a `:root` that lives inside a string value or comment of another
    // rule — it is text, not a selector.
    if (isInsideStringOrComment(source, match.index)) {
      match = rootRe.exec(source);
      continue;
    }
    const braceIdx = match.index + match[0].length - 1;
    const endIdx = findBlockEnd(source, braceIdx);
    if (endIdx > braceIdx) {
      parseRootBody(source.slice(braceIdx + 1, endIdx), out);
      rootRe.lastIndex = endIdx + 1;
    } else {
      // Unbalanced/truncated — parse what we can to the end, then stop.
      parseRootBody(source.slice(braceIdx + 1), out);
      break;
    }
    match = rootRe.exec(source);
  }
  return out;
}
