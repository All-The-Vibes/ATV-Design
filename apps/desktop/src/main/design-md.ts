/**
 * DESIGN.md parser and writer for workspace design systems.
 *
 * Kept Electron-main-local (not in packages/core) to avoid touching the agent
 * runtime boundary — per HC #7 ("Reuse pi primitives first").
 *
 * Keep in sync with:
 *   apps/desktop/src/renderer/src/store.ts  BUILT_IN_DESIGN_SYSTEM
 *   apps/desktop/src/main/default-design-system.ts  createDefaultDesignSystemSnapshot
 */

import type { StoredDesignSystem } from '@atv-design/shared';
import { collectCssVarValues, collectLooseValues } from './design-system';

export interface ParsedDesignMd {
  colors: string[];
  fonts: string[];
  spacing: string[];
  radius: string[];
  shadows: string[];
  components: { name: string; rule: string }[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function extractCssBlocks(section: string): string {
  const blocks: string[] = [];
  for (const m of section.matchAll(/```css\s*\n([\s\S]*?)```/gi)) {
    if (m[1]) blocks.push(m[1]);
  }
  return blocks.join('\n');
}

function parseComponentLines(section: string): { name: string; rule: string }[] {
  const components: { name: string; rule: string }[] = [];
  let passedHeading = false;
  for (const line of section.split('\n')) {
    // Skip the opening "## N. ..." heading, stop at subsequent headings
    if (/^##\s/.test(line)) {
      if (!passedHeading) {
        passedHeading = true;
        continue;
      }
      break;
    }
    // Match "- **Name**: rule" or "- Name: rule"
    const m = line.match(/^\s*-\s+\*{0,2}([^*:]+)\*{0,2}:\s+(.+)$/);
    if (m?.[1] && m[2]) {
      components.push({ name: m[1].trim(), rule: m[2].trim() });
    }
  }
  return components;
}

interface SectionBounds {
  start: number;
  end: number;
}

function getHeadings(text: string): Array<{ index: number }> {
  const re = /^## \d+\./gm;
  const out: Array<{ index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ index: m.index });
  }
  return out;
}

function findSectionBounds(
  text: string,
  headings: Array<{ index: number }>,
  pattern: RegExp,
): SectionBounds | null {
  const idx = headings.findIndex((h) => pattern.test(text.slice(h.index, h.index + 60)));
  if (idx === -1) return null;
  const heading = headings[idx];
  if (!heading) return null;
  const start = heading.index;
  const nextHeading = headings[idx + 1];
  const end = nextHeading !== undefined ? nextHeading.index : text.length;
  return { start, end };
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'token'
  );
}

function buildFoundationsSection(snap: StoredDesignSystem): string {
  const colorLines = snap.colors.map((v) => `  --color-${slugify(v)}: ${v};`).join('\n');
  const fontLines = snap.fonts
    .map((v, i) => `  --font-${i === 0 ? 'display' : i === 1 ? 'sans' : 'mono'}: ${v};`)
    .join('\n');
  const spacingLines = snap.spacing.map((v, i) => `  --space-${i + 1}: ${v};`).join('\n');
  const radiusLabels = ['sm', 'md', 'lg', '2xl'];
  const radiusLines = snap.radius
    .map((v, i) => `  --radius-${radiusLabels[i] ?? String(i)}: ${v};`)
    .join('\n');
  const shadowLines = snap.shadows
    .map((v, i) => `  --shadow-${i === 0 ? 'card' : String(i)}: ${v};`)
    .join('\n');

  const blocks: string[] = [];
  if (colorLines) blocks.push(`### Color tokens\n\n\`\`\`css\n:root {\n${colorLines}\n}\n\`\`\``);
  if (fontLines)
    blocks.push(`### Typography tokens\n\n\`\`\`css\n:root {\n${fontLines}\n}\n\`\`\``);
  const layoutLines = [spacingLines, radiusLines, shadowLines].filter(Boolean).join('\n');
  if (layoutLines)
    blocks.push(`### Layout tokens\n\n\`\`\`css\n:root {\n${layoutLines}\n}\n\`\`\``);

  return `## 3. Foundations\n\n${blocks.join('\n\n')}`;
}

function buildComponentRulesSection(snap: StoredDesignSystem): string {
  const items = snap.components ?? [];
  if (items.length === 0) return '## 4. Component rules\n';
  const lines = items.map((c) => `- **${c.name}**: ${c.rule}`).join('\n');
  return `## 4. Component rules\n\n${lines}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a raw DESIGN.md string into token arrays and component rules.
 * Missing sections return empty arrays — never throws.
 */
export function parseDesignMd(raw: string): ParsedDesignMd {
  const colors: string[] = [];
  const fonts: string[] = [];
  const spacing: string[] = [];
  const radius: string[] = [];
  const shadows: string[] = [];
  let components: { name: string; rule: string }[] = [];

  try {
    const parts = raw.split(/^(?=## \d+\.)/m);
    for (const part of parts) {
      if (/^## 3\.\s+Foundations/i.test(part)) {
        const cssText = extractCssBlocks(part);
        collectCssVarValues(cssText, colors, spacing, radius, shadows);
        collectLooseValues(cssText, colors, fonts, spacing, radius, shadows);
        // Also scan loose font-family lines outside CSS blocks
        collectLooseValues(part, colors, fonts, spacing, radius, shadows);
      } else if (/^## 4\.\s+Component/i.test(part)) {
        components = parseComponentLines(part);
      }
    }
  } catch {
    // Be lenient — return whatever was collected
  }

  return { colors, fonts, spacing, radius, shadows, components };
}

/**
 * Rewrite a DESIGN.md string, splicing §3 Foundations and §4 Component rules
 * from `snapshot` while preserving all other content verbatim.
 *
 * Strategy:
 * 1. Locate §3 and §4 heading boundaries.
 * 2. Replace only those sections.
 * 3. If a heading is missing, append new sections at the end.
 */
export function rewriteDesignMd(existing: string, snapshot: StoredDesignSystem): string {
  const foundations = buildFoundationsSection(snapshot);
  const componentRules = buildComponentRulesSection(snapshot);

  const headings = getHeadings(existing);
  const sec3 = findSectionBounds(existing, headings, /^## 3\.\s+Foundations/im);
  const sec4 = findSectionBounds(existing, headings, /^## 4\.\s+Component/im);

  if (sec3 === null && sec4 === null) {
    const trimmed = existing.trimEnd();
    return `${trimmed}\n\n${foundations}\n\n${componentRules}\n`;
  }

  // Replace in reverse order (high index first) so positions don't shift
  const sections = [
    ...(sec3 !== null ? [{ ...sec3, replacement: foundations }] : []),
    ...(sec4 !== null ? [{ ...sec4, replacement: componentRules }] : []),
  ].sort((a, b) => b.start - a.start);

  let result = existing;
  for (const { start, end, replacement } of sections) {
    result = `${result.slice(0, start)}${replacement}\n${result.slice(end)}`;
  }

  // If §3 was missing, insert before §4 (now in place)
  if (sec3 === null && sec4 !== null) {
    const new4 = findSectionBounds(result, getHeadings(result), /^## 4\.\s+Component/im);
    if (new4) {
      result = `${result.slice(0, new4.start)}${foundations}\n\n${result.slice(new4.start)}`;
    }
  }

  // If §4 was missing, insert after §3 (now in place)
  if (sec4 === null && sec3 !== null) {
    const new3 = findSectionBounds(result, getHeadings(result), /^## 3\.\s+Foundations/im);
    if (new3) {
      result = `${result.slice(0, new3.end)}${componentRules}\n${result.slice(new3.end)}`;
    }
  }

  return result;
}
