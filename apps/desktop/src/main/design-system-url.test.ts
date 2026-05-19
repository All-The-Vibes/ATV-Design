/**
 * Unit tests for extractDesignSystemFromUrl.
 * Mocks global `fetch` so no real network calls are made.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractDesignSystemFromUrl } from './design-system-url';

// Minimal HTML with an inline <style> and a same-origin <link>
const SAMPLE_HTML = `<!doctype html>
<html>
<head>
  <link rel="stylesheet" href="/styles/tokens.css">
  <style>
    :root {
      --color-accent: #e05a2b;
      --space-4: 16px;
      --radius-md: 8px;
      --shadow-card: 0 2px 8px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <h1 style="font-family: 'Inter', sans-serif;">Hello</h1>
</body>
</html>`;

const SAMPLE_CSS = `
:root {
  --color-background: #fafafa;
  --font-sans: "Geist Variable", system-ui;
  --space-8: 32px;
}
body {
  font-family: "Geist Variable", system-ui;
}
.button {
  background: #e05a2b;
  border-radius: 6px;
}
`;

function makeFetchMock(urlResponses: Record<string, string>) {
  return vi.fn((url: string) => {
    const body = urlResponses[url];
    if (body === undefined) {
      return Promise.resolve({
        ok: false,
        status: 404,
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as Response);
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    } as unknown as Response);
  });
}

beforeEach(() => {
  vi.stubGlobal('AbortSignal', { timeout: (_ms: number) => ({ aborted: false }) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('extractDesignSystemFromUrl', () => {
  it('extracts colors from inline <style> block', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        'https://example.com': SAMPLE_HTML,
        'https://example.com/styles/tokens.css': SAMPLE_CSS,
      }),
    );

    const ds = await extractDesignSystemFromUrl('https://example.com');

    expect(ds.colors).toContain('#e05a2b');
    expect(ds.source?.kind).toBe('url');
    expect(ds.source?.value).toBe('https://example.com');
    expect(ds.displayName).toBe('example.com');
  });

  it('extracts fonts from linked stylesheet', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        'https://example.com': SAMPLE_HTML,
        'https://example.com/styles/tokens.css': SAMPLE_CSS,
      }),
    );

    const ds = await extractDesignSystemFromUrl('https://example.com');

    expect(ds.fonts.some((f) => f.includes('Geist'))).toBe(true);
  });

  it('extracts spacing and radius from inline CSS vars', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        'https://example.com': SAMPLE_HTML,
        'https://example.com/styles/tokens.css': '',
      }),
    );

    const ds = await extractDesignSystemFromUrl('https://example.com');

    expect(ds.spacing).toContain('16px');
    expect(ds.radius).toContain('8px');
  });

  it('sets rootPath to the URL and sourceFiles[0] to the URL', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        'https://example.com': SAMPLE_HTML,
        'https://example.com/styles/tokens.css': SAMPLE_CSS,
      }),
    );

    const ds = await extractDesignSystemFromUrl('https://example.com');

    expect(ds.rootPath).toBe('https://example.com');
    expect(ds.sourceFiles[0]).toBe('https://example.com');
  });

  it('includes linked stylesheet URL in sourceFiles', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        'https://example.com': SAMPLE_HTML,
        'https://example.com/styles/tokens.css': SAMPLE_CSS,
      }),
    );

    const ds = await extractDesignSystemFromUrl('https://example.com');

    expect(ds.sourceFiles).toContain('https://example.com/styles/tokens.css');
  });

  it('throws on an invalid URL', async () => {
    vi.stubGlobal('fetch', makeFetchMock({}));
    await expect(extractDesignSystemFromUrl('not-a-url')).rejects.toThrow(/Invalid URL/);
  });

  it('handles stylesheet fetch failure gracefully (no throw)', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        'https://example.com': SAMPLE_HTML,
        // tokens.css deliberately omitted → 404
      }),
    );

    const ds = await extractDesignSystemFromUrl('https://example.com');
    // Should still return a snapshot from inline styles
    expect(ds.schemaVersion).toBe(1);
    expect(ds.colors.length).toBeGreaterThan(0);
  });
});
