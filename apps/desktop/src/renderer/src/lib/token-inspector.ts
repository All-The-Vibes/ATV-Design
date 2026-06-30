/**
 * T2/T3 — DesignCanvas split, unit 2: live design-token inspector.
 *
 * Ported from Terminal 42 `DesignCanvas.tsx` (readProjectTokens + classifyToken),
 * part of the annotate→AI + token-inspector "crown jewel" (analysis doc §2).
 * Pulled out of the 2,249-line god-component (eng-review CQ-F4) into a pure,
 * testable module the ported Canvas + TokenInspector view compose.
 *
 * The complex, value-bearing logic (parse :root blocks, extract --props,
 * classify by shape, order for the swatch list) lives in `parseRootTokens`,
 * which operates on raw CSS text and is unit-testable with no DOM. The thin
 * `readProjectTokens(doc)` wrapper walks a design document's <style> tags and
 * delegates — so the desktop package keeps its DOM-free unit-test convention.
 *
 * Attribution: Terminal 42 by akwasijr (see ATTRIBUTION.md), MIT per merge Q5.
 */

export type ProjectTokenKind = 'color' | 'number' | 'text';

export interface ProjectToken {
  name: string;
  value: string;
  kind: ProjectTokenKind;
}

/** Classify a CSS custom-property value by its shape, for the inspector. */
export function classifyToken(value: string): ProjectTokenKind {
  const v = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return 'color';
  if (/^rgba?\(/i.test(v)) return 'color';
  if (/^hsla?\(/i.test(v)) return 'color';
  if (/^[\d.+-]+(px|em|rem|%|vw|vh|s|ms)?$/.test(v)) return 'number';
  return 'text';
}

const ORDER = { color: 0, number: 1, text: 2 } as const;

/**
 * Pure core: given one or more chunks of CSS text (e.g. each <style> tag's
 * textContent), find `:root { … }` / `html { … }` blocks, extract the
 * `--custom-prop` declarations, classify each, dedupe (first wins), and order
 * color → number → text for the inspector swatch list.
 *
 * `resolve` optionally collapses var()-references to concrete values (the DOM
 * wrapper passes getComputedStyle); without it the literal declaration is used.
 */
export function parseRootTokens(
  cssChunks: string[],
  resolve?: (name: string) => string,
): ProjectToken[] {
  const out: ProjectToken[] = [];
  const seen = new Set<string>();
  for (const text of cssChunks) {
    const rootBlocks = text.match(/(?::root|html)[^{]*\{([^}]*)\}/g);
    if (!rootBlocks) continue;
    for (const block of rootBlocks) {
      const body = block.replace(/^[^{]*\{/, '').replace(/\}$/, '');
      for (const d of body.split(/;/)) {
        const m = d.match(/\s*(--[\w-]+)\s*:\s*([^;]+)/);
        if (!m || !m[1] || !m[2]) continue;
        const name = m[1].trim();
        if (seen.has(name)) continue;
        seen.add(name);
        let resolved = '';
        if (resolve) {
          try {
            resolved = resolve(name).trim();
          } catch {
            // resolver unavailable for this prop — fall back to the literal.
          }
        }
        const value = resolved || m[2].trim();
        out.push({ name, value, kind: classifyToken(value) });
      }
    }
  }
  return out.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
}

/**
 * DOM wrapper: walk every <style> tag in the design document and extract its
 * :root tokens. var()-references resolve via getComputedStyle when available.
 */
export function readProjectTokens(doc: Document): ProjectToken[] {
  const chunks: string[] = [];
  doc.querySelectorAll('style').forEach((el) => chunks.push(el.textContent ?? ''));
  const view = doc.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const resolve = view
    ? (name: string) => view.getComputedStyle(doc.documentElement).getPropertyValue(name)
    : undefined;
  return parseRootTokens(chunks, resolve);
}
