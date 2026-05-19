/**
 * Unit tests for design-md.ts: parseDesignMd + rewriteDesignMd.
 */

import { describe, expect, it } from 'vitest';
import { parseDesignMd, rewriteDesignMd } from './design-md';

const TEMPLATE = `# DESIGN.md

## 1. Product and audience

- Product: test product.

## 2. Brand personality

- Calm and crafted.

## 3. Foundations

### Color tokens

\`\`\`css
:root {
  --color-background: oklch(0.98 0.012 80);
  --color-accent: oklch(0.62 0.16 35);
}
\`\`\`

### Typography tokens

\`\`\`css
:root {
  --font-sans: "Geist Variable", system-ui, sans-serif;
}
\`\`\`

### Layout tokens

\`\`\`css
:root {
  --space-1: 4px;
  --radius-sm: 6px;
  --shadow-card: 0 1px 2px rgba(0,0,0,0.05);
}
\`\`\`

## 4. Component rules

- **Buttons**: expose hover, press, and focus states.
- Cards: use --color-surface and --radius-lg.

## 5. Interaction rules

- Every button must produce a state change.

## 6. Accessibility

- Meet WCAG AA.
`;

const SNAPSHOT = {
  schemaVersion: 1 as const,
  rootPath: 'test',
  summary: 'test summary',
  extractedAt: new Date().toISOString(),
  sourceFiles: ['DESIGN.md'],
  colors: ['oklch(0.98 0.012 80)', 'oklch(0.62 0.16 35)'],
  fonts: ['"Geist Variable"'],
  spacing: ['4px', '8px'],
  radius: ['6px'],
  shadows: ['0 1px 2px rgba(0,0,0,0.05)'],
  components: [
    { name: 'Buttons', rule: 'Expose hover and focus states.' },
    { name: 'Cards', rule: 'Use --color-surface.' },
  ],
};

describe('parseDesignMd', () => {
  it('extracts colors from §3 CSS blocks', () => {
    const result = parseDesignMd(TEMPLATE);
    expect(result.colors).toContain('oklch(0.98 0.012 80)');
    expect(result.colors).toContain('oklch(0.62 0.16 35)');
  });

  it('extracts spacing from §3 CSS blocks', () => {
    const result = parseDesignMd(TEMPLATE);
    expect(result.spacing).toContain('4px');
  });

  it('extracts radius from §3 CSS blocks', () => {
    const result = parseDesignMd(TEMPLATE);
    expect(result.radius).toContain('6px');
  });

  it('extracts shadows from §3 CSS blocks', () => {
    const result = parseDesignMd(TEMPLATE);
    expect(result.shadows.length).toBeGreaterThan(0);
  });

  it('extracts component rules from §4', () => {
    const result = parseDesignMd(TEMPLATE);
    expect(result.components).toHaveLength(2);
    expect(result.components[0]).toMatchObject({ name: 'Buttons' });
    expect(result.components[1]).toMatchObject({ name: 'Cards' });
  });

  it('returns empty arrays for missing sections without throwing', () => {
    const result = parseDesignMd('# DESIGN.md\n\nNo sections here.');
    expect(result.colors).toEqual([]);
    expect(result.fonts).toEqual([]);
    expect(result.components).toEqual([]);
  });

  it('does not throw on empty string', () => {
    expect(() => parseDesignMd('')).not.toThrow();
  });
});

describe('rewriteDesignMd', () => {
  it('preserves §1, §2 content before §3', () => {
    const result = rewriteDesignMd(TEMPLATE, SNAPSHOT);
    expect(result).toContain('## 1. Product and audience');
    expect(result).toContain('Product: test product.');
    expect(result).toContain('## 2. Brand personality');
  });

  it('preserves §5+ content after §4', () => {
    const result = rewriteDesignMd(TEMPLATE, SNAPSHOT);
    expect(result).toContain('## 5. Interaction rules');
    expect(result).toContain('Every button must produce a state change.');
    expect(result).toContain('## 6. Accessibility');
    expect(result).toContain('Meet WCAG AA.');
  });

  it('writes component rules as bold-name bullets', () => {
    const result = rewriteDesignMd(TEMPLATE, SNAPSHOT);
    expect(result).toContain('- **Buttons**: Expose hover and focus states.');
    expect(result).toContain('- **Cards**: Use --color-surface.');
  });

  it('round-trip: parseDesignMd(rewriteDesignMd) yields snapshot component names', () => {
    const rewritten = rewriteDesignMd(TEMPLATE, SNAPSHOT);
    const parsed = parseDesignMd(rewritten);
    const names = parsed.components.map((c: { name: string; rule: string }) => c.name);
    expect(names).toContain('Buttons');
    expect(names).toContain('Cards');
  });

  it('appends sections when headings are missing', () => {
    const minimal = '# DESIGN.md\n\nSome content.\n';
    const result = rewriteDesignMd(minimal, SNAPSHOT);
    expect(result).toContain('## 3. Foundations');
    expect(result).toContain('## 4. Component rules');
    expect(result).toContain('Some content.');
  });

  it('empty components snapshot writes valid §4 heading', () => {
    const empty = { ...SNAPSHOT, components: [] };
    const result = rewriteDesignMd(TEMPLATE, empty);
    expect(result).toContain('## 4. Component rules');
  });

  it('empty snapshot still writes valid §3 foundations', () => {
    const empty = {
      ...SNAPSHOT,
      colors: [],
      fonts: [],
      spacing: [],
      radius: [],
      shadows: [],
    };
    const result = rewriteDesignMd(TEMPLATE, empty);
    expect(result).toContain('## 3. Foundations');
  });
});
