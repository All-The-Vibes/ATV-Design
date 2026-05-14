import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { STORED_DESIGN_SYSTEM_SCHEMA_VERSION, type StoredDesignSystem } from '@atv-design/shared';

export const DEFAULT_DESIGN_SYSTEM_FILE = 'DESIGN.md';

const DEFAULT_ROOT_PATH = 'atv-design-default';
const TOKEN_SOURCE = 'packages/ui/src/tokens.css';

export function buildDefaultDesignSystemMarkdown(designName?: string | null): string {
  const trimmedName = typeof designName === 'string' ? designName.trim() : '';
  const designLine = trimmedName.length > 0 ? `\nDesign: ${trimmedName}\n` : '\n';

  return `# DESIGN.md
${designLine}
This file is the living design system for this workspace. Update it before final delivery whenever the artifact establishes stronger product, brand, layout, component, or interaction decisions.

Source: ${TOKEN_SOURCE}

## 1. Product and audience

- Product: workspace-local design artifact created in ATV Design.
- Audience: users who need a polished prototype and reusable visual decisions, not a one-off mock.
- Quality bar: deliberate hierarchy, consistent token usage, accessible contrast, and interaction states that feel designed.

## 2. Brand personality

- Calm, crafted, local-first, and tool-like without feeling generic.
- Prefer warm editorial confidence over default SaaS blue.
- Use restraint: one primary accent, one supporting accent only when it clarifies hierarchy or state.

## 3. Foundations

### Color tokens

\`\`\`css
:root {
  --color-background: oklch(0.98 0.012 80);
  --color-surface: oklch(0.99 0.008 80);
  --color-surface-raised: oklch(0.96 0.018 75);
  --color-border: oklch(0.86 0.026 72);
  --color-accent: oklch(0.62 0.16 35);
  --color-accent-soft: oklch(0.9 0.058 42);
  --color-text-primary: oklch(0.22 0.025 50);
  --color-text-secondary: oklch(0.5 0.02 55);
  --color-focus: oklch(0.62 0.16 35);
}
\`\`\`

### Typography tokens

\`\`\`css
:root {
  --font-display: "Fraunces Variable", "Times New Roman", serif;
  --font-sans: "Geist Variable", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;
  --type-display: clamp(2.75rem, 7vw, 5.75rem);
  --type-title: clamp(1.75rem, 3vw, 2.5rem);
  --type-body: 1rem;
  --type-caption: 0.8125rem;
}
\`\`\`

### Layout tokens

\`\`\`css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-2xl: 18px;
  --shadow-card: 0 1px 2px oklch(0.3 0.02 45 / 0.04), 0 4px 16px oklch(0.3 0.02 45 / 0.06);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
\`\`\`

## 4. Component rules

- Cards: use \`--color-surface\`, \`--color-border\`, \`--radius-lg\`, and \`--shadow-card\`; avoid unstructured floating boxes.
- Buttons: expose hover, press, and focus states. Active state must use shape or weight, not color alone.
- Data blocks: large numbers use \`--font-mono\` or a sans face with tabular numerals; never italic serif numerals for KPIs.
- Empty states: include an icon/scene, a reason, and a next action.

## 5. Interaction rules

- Every visible button or link must produce an observable state change, modal, tab switch, toast, or navigation stub.
- Motion should be CSS-first, 120-260ms, and explain state changes rather than decorate static pixels.
- Keyboard focus must be visible with \`--color-focus\`.

## 6. Accessibility

- Meet WCAG AA contrast for text and controls.
- Preserve semantic landmarks and heading order.
- Do not communicate status with color alone.

## 7. Maintenance rules

- Treat this file as the source of truth for the current design's system.
- If the prompt, attached files, or brand references establish better tokens, update this file first and then use those tokens in the artifact.
- If the artifact introduces a reusable component pattern, add the rule here before calling done.
- Do not invent third-party brand values. Use user-provided files, official CSS/SVG/screenshots, or brand URLs as source material.
`;
}

export async function ensureWorkspaceDesignSystem(
  workspacePath: string,
  designName?: string | null,
): Promise<string> {
  await mkdir(workspacePath, { recursive: true });
  const designSystemPath = path.join(workspacePath, DEFAULT_DESIGN_SYSTEM_FILE);

  try {
    await writeFile(designSystemPath, buildDefaultDesignSystemMarkdown(designName), {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException | undefined)?.code !== 'EEXIST') {
      throw err;
    }
  }

  return designSystemPath;
}

export function createDefaultDesignSystemSnapshot(
  rootPath = DEFAULT_ROOT_PATH,
): StoredDesignSystem {
  return {
    schemaVersion: STORED_DESIGN_SYSTEM_SCHEMA_VERSION,
    rootPath,
    sourceFiles: [DEFAULT_DESIGN_SYSTEM_FILE],
    colors: [
      'oklch(0.98 0.012 80)',
      'oklch(0.99 0.008 80)',
      'oklch(0.62 0.16 35)',
      'oklch(0.22 0.025 50)',
      'oklch(0.5 0.02 55)',
    ],
    fonts: ['"Fraunces Variable"', '"Geist Variable"', '"JetBrains Mono Variable"'],
    spacing: ['4px', '8px', '12px', '16px', '24px', '32px'],
    radius: ['6px', '10px', '14px', '18px'],
    shadows: ['0 1px 2px oklch(0.3 0.02 45 / 0.04), 0 4px 16px oklch(0.3 0.02 45 / 0.06)'],
    summary:
      'ATV Design default: warm cream surfaces, terracotta accent, editorial display type, precise sans UI text, and explicit workspace tokens.',
    extractedAt: new Date().toISOString(),
  };
}
