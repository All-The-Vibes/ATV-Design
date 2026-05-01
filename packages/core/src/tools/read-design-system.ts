/**
 * read_design_system — expose the extracted design system tokens as a
 * tool rather than dumping them in the system prompt. The agent can fetch
 * them on demand when it's actually picking colors / fonts / spacing,
 * rather than paying the prompt-token cost every turn.
 */

import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import type { StoredDesignSystem } from '@open-codesign/shared';
import { Type } from '@sinclair/typebox';

const ReadDesignSystemParams = Type.Object({});

export interface ReadDesignSystemDetails {
  available: boolean;
  rootPath?: string;
}

export function makeReadDesignSystemTool(
  getDesignSystem: () => StoredDesignSystem | null | undefined,
): AgentTool<typeof ReadDesignSystemParams, ReadDesignSystemDetails> {
  return {
    name: 'read_design_system',
    label: 'Read design system',
    description:
      "Return the extracted tokens from the project's linked design system " +
      '(colors, fonts, spacing, radii, shadows). Call this when you need to ' +
      'match brand palette or typography. Returns an empty result if no ' +
      'design system is linked.',
    parameters: ReadDesignSystemParams,
    async execute(): Promise<AgentToolResult<ReadDesignSystemDetails>> {
      const ds = getDesignSystem();
      if (!ds) {
        return {
          content: [
            {
              type: 'text',
              text: 'No design system linked. Proceed with sensible defaults.',
            },
          ],
          details: { available: false },
        };
      }
      const lines = [`# ${ds.summary}`, `Root path: ${ds.rootPath}`];
      if (ds.colors.length > 0) lines.push(`\n## Colors\n${ds.colors.join(', ')}`);
      if (ds.fonts.length > 0) lines.push(`\n## Fonts\n${ds.fonts.join(', ')}`);
      if (ds.spacing.length > 0) lines.push(`\n## Spacing\n${ds.spacing.join(', ')}`);
      if (ds.radius.length > 0) lines.push(`\n## Radius\n${ds.radius.join(', ')}`);
      if (ds.shadows.length > 0) lines.push(`\n## Shadows\n${ds.shadows.join(', ')}`);
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: { available: true, rootPath: ds.rootPath },
      };
    },
  };
}
