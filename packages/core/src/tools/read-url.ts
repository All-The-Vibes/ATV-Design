/**
 * read_url — fetch a URL and return a stripped-text excerpt the model can
 * use to inform the design. This is a deliberate lightweight implementation:
 * no headless browser, no JS execution, just HTML → plain text with a
 * length cap. The model doesn't need pixel-perfect DOM; it needs copy +
 * structure hints.
 */

import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import { Type } from '@sinclair/typebox';

const ReadUrlParams = Type.Object({
  url: Type.String(),
  maxChars: Type.Optional(Type.Number()),
});

export interface ReadUrlDetails {
  url: string;
  status: number;
  charsReturned: number;
  truncated: boolean;
}

function stripHtmlToText(html: string): string {
  return (
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      // Preserve paragraph/heading breaks as newlines so the model can see
      // structure without real block-level markup.
      .replace(/<\/(p|div|section|article|header|footer|li|h[1-6]|br)\s*>/gi, '\n')
      .replace(/<br\s*\/?>(?!\n)/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

export function makeReadUrlTool(): AgentTool<typeof ReadUrlParams, ReadUrlDetails> {
  return {
    name: 'read_url',
    label: 'Read URL',
    description:
      'Fetch a public URL and return its visible text (stripped of HTML, ' +
      'scripts, styles). Use this to pull copy/facts from a reference URL ' +
      'the user supplied. Output is capped at maxChars (default 4000).',
    parameters: ReadUrlParams,
    async execute(_id, params, signal): Promise<AgentToolResult<ReadUrlDetails>> {
      const max = params.maxChars ?? 4000;
      let res: Response;
      try {
        res = await fetch(params.url, {
          ...(signal ? { signal } : {}),
          headers: {
            'user-agent': 'open-codesign/0.1 (+https://github.com/hqhq1025/codesign)',
            accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Network request failed: ${msg}`);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${params.url}`);
      }
      const body = await res.text();
      const text = stripHtmlToText(body);
      const truncated = text.length > max;
      const out = truncated ? `${text.slice(0, max)}\n\n[…truncated at ${max} chars]` : text;
      return {
        content: [{ type: 'text', text: out }],
        details: {
          url: params.url,
          status: res.status,
          charsReturned: out.length,
          truncated,
        },
      };
    },
  };
}
