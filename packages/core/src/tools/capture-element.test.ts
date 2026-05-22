/**
 * Tests for capture-element tool.
 *
 * puppeteer-core and findSystemChrome are both mocked so these tests run in CI
 * without a real Chrome install. Live network captures are part of the manual
 * acceptance pass.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mocks must reference state via closures created inside the factory.
// Each mock is given an explicit signature so vitest 4's stricter Mock type
// (Procedure | Constructable) narrows to the callable form we use here.
const mocks: {
  findSystemChrome: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<string>>>;
  launch: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<unknown>>>;
  evaluate: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<unknown>>>;
  goto: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<unknown>>>;
  waitForSelector: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<unknown>>>;
  screenshot: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<Uint8Array>>>;
  close: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<void>>>;
} = {
  findSystemChrome: vi.fn<(...args: unknown[]) => Promise<string>>(),
  launch: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  evaluate: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  goto: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  waitForSelector: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  screenshot: vi.fn<(...args: unknown[]) => Promise<Uint8Array>>(),
  close: vi.fn<(...args: unknown[]) => Promise<void>>(),
};

// capture-element.ts imports findSystemChrome from the /node subpath
// (the renderer-safe split). The mock must target that exact specifier —
// mocking '@atv-design/shared' alone leaves the real implementation in place.
vi.mock('@atv-design/shared/node', async () => {
  const actual =
    await vi.importActual<typeof import('@atv-design/shared/node')>('@atv-design/shared/node');
  return {
    ...actual,
    findSystemChrome: (...args: unknown[]) => mocks.findSystemChrome(...args),
  };
});

vi.mock('puppeteer-core', () => ({
  launch: (...args: unknown[]) => mocks.launch(...args),
}));

import { type CaptureElementFs, makeCaptureElementTool } from './capture-element.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFakeFs(): {
  fs: CaptureElementFs;
  writes: Array<{ path: string; bytes: Uint8Array }>;
  mkdirs: string[];
} {
  const writes: Array<{ path: string; bytes: Uint8Array }> = [];
  const mkdirs: string[] = [];
  return {
    fs: {
      mkdir: async (p: string) => {
        mkdirs.push(p);
      },
      writeFile: async (p: string, data: Uint8Array) => {
        writes.push({ path: p, bytes: data });
      },
    },
    writes,
    mkdirs,
  };
}

function fakeElementHandle() {
  return {
    screenshot: (...args: unknown[]) => mocks.screenshot(...args),
  };
}

function installHappyPathMocks(): void {
  mocks.findSystemChrome.mockResolvedValue('/usr/bin/google-chrome');
  mocks.screenshot.mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  mocks.goto.mockResolvedValue(undefined);
  mocks.waitForSelector.mockResolvedValue(fakeElementHandle());
  mocks.evaluate.mockImplementation(async (_fn: unknown, _el: unknown, keys?: unknown) => {
    if (Array.isArray(keys)) {
      // styles branch
      return { color: 'rgb(0, 0, 0)', 'font-size': '16px' };
    }
    // dom branch
    return '<div class="card">hello</div>';
  });
  mocks.close.mockResolvedValue(undefined);
  mocks.launch.mockImplementation(async () => ({
    newPage: async () => ({
      goto: (...args: unknown[]) => mocks.goto(...args),
      waitForSelector: (...args: unknown[]) => mocks.waitForSelector(...args),
      evaluate: (...args: unknown[]) => mocks.evaluate(...args),
    }),
    close: (...args: unknown[]) => mocks.close(...args),
  }));
}

// ── Descriptor ────────────────────────────────────────────────────────────────

describe('makeCaptureElementTool descriptor', () => {
  it('returns expected name and label', () => {
    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    expect(tool.name).toBe('capture_element');
    expect(tool.label).toBe('Capture element from external URL');
  });

  it('has parameters with url, selector, and format', () => {
    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const props = (tool.parameters as { properties?: unknown }).properties as Record<
      string,
      unknown
    >;
    expect(props).toHaveProperty('url');
    expect(props).toHaveProperty('selector');
    expect(props).toHaveProperty('format');
  });
});

// ── URL validation (runs without touching puppeteer) ──────────────────────────

describe('URL scheme guard', () => {
  beforeEach(() => {
    for (const key of Object.keys(mocks) as Array<keyof typeof mocks>) {
      mocks[key].mockReset();
    }
  });

  it('rejects file:// URLs without launching Chrome', async () => {
    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const result = await tool.execute(
      'id-1',
      { url: 'file:///etc/passwd', selector: 'body', format: 'dom' },
      undefined,
    );
    expect(result.details.ok).toBe(false);
    expect(result.details.error).toMatch(/http or https/);
    expect(mocks.findSystemChrome).not.toHaveBeenCalled();
    expect(mocks.launch).not.toHaveBeenCalled();
  });

  it('rejects malformed URLs without launching Chrome', async () => {
    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const result = await tool.execute(
      'id-1',
      { url: 'not a url', selector: '.x', format: 'dom' },
      undefined,
    );
    expect(result.details.ok).toBe(false);
    expect(mocks.launch).not.toHaveBeenCalled();
  });

  it('rejects ftp:// URLs without launching Chrome', async () => {
    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const result = await tool.execute(
      'id-1',
      { url: 'ftp://example.com/foo', selector: '.x', format: 'dom' },
      undefined,
    );
    expect(result.details.ok).toBe(false);
    expect(mocks.launch).not.toHaveBeenCalled();
  });
});

// ── Chrome discovery failure ──────────────────────────────────────────────────

describe('findSystemChrome failure', () => {
  beforeEach(() => {
    for (const key of Object.keys(mocks) as Array<keyof typeof mocks>) {
      mocks[key].mockReset();
    }
  });

  it('returns an error result with a Chrome install hint (no crash)', async () => {
    mocks.findSystemChrome.mockRejectedValue(new Error('Chrome not found'));

    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const result = await tool.execute(
      'id-1',
      { url: 'https://example.com', selector: '.x', format: 'dom' },
      undefined,
    );
    expect(result.details.ok).toBe(false);
    expect(result.details.error).toMatch(/Chrome/i);
    expect(result.details.warnings.length).toBeGreaterThan(0);
    expect(result.details.warnings[0]).toMatch(/Install Chrome/);
    expect(mocks.launch).not.toHaveBeenCalled();
  });
});

// ── Selector not found ────────────────────────────────────────────────────────

describe('selector not found', () => {
  beforeEach(() => {
    for (const key of Object.keys(mocks) as Array<keyof typeof mocks>) {
      mocks[key].mockReset();
    }
    installHappyPathMocks();
  });

  it('returns ok:false with the selector echoed', async () => {
    mocks.waitForSelector.mockRejectedValue(new Error('timeout'));

    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const result = await tool.execute(
      'id-1',
      { url: 'https://example.com', selector: '.missing-card', format: 'dom' },
      undefined,
    );
    expect(result.details.ok).toBe(false);
    expect(result.details.error).toContain('.missing-card');
    expect(mocks.close).toHaveBeenCalled();
  });

  it('returns ok:false when waitForSelector resolves to null', async () => {
    mocks.waitForSelector.mockResolvedValue(null);

    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const result = await tool.execute(
      'id-1',
      { url: 'https://example.com', selector: '.empty', format: 'dom' },
      undefined,
    );
    expect(result.details.ok).toBe(false);
    expect(result.details.error).toContain('.empty');
  });
});

// ── Page navigation timeout ──────────────────────────────────────────────────

describe('page navigation timeout', () => {
  beforeEach(() => {
    for (const key of Object.keys(mocks) as Array<keyof typeof mocks>) {
      mocks[key].mockReset();
    }
    installHappyPathMocks();
  });

  it('returns a structured error result on goto timeout', async () => {
    mocks.goto.mockRejectedValue(new Error('Navigation timeout of 15000 ms exceeded'));

    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const result = await tool.execute(
      'id-1',
      { url: 'https://slow.example.com', selector: 'body', format: 'dom' },
      undefined,
    );
    expect(result.details.ok).toBe(false);
    expect(result.details.error).toMatch(/navigation/i);
    expect(result.details.error).toContain('slow.example.com');
    expect(mocks.close).toHaveBeenCalled();
  });
});

// ── PNG happy path ──────────────────────────────────────────────────────────��

describe('PNG happy path', () => {
  beforeEach(() => {
    for (const key of Object.keys(mocks) as Array<keyof typeof mocks>) {
      mocks[key].mockReset();
    }
    installHappyPathMocks();
  });

  it('writes the PNG and returns a relative workspace path', async () => {
    const { fs, writes, mkdirs } = makeFakeFs();
    const tool = makeCaptureElementTool({
      workspacePath: '/ws/design-root',
      designId: null,
      fs,
    });

    const result = await tool.execute(
      'id-1',
      { url: 'https://example.com', selector: '.pricing-card', format: 'png' },
      undefined,
    );

    expect(result.details.ok).toBe(true);
    expect(result.details.result?.pngPath).toBeDefined();
    expect(result.details.result?.pngPath).toMatch(/^assets\/captures\/[a-f0-9]+\.png$/);

    // PNG was actually written
    expect(writes.length).toBe(1);
    expect(writes[0]?.bytes.byteLength).toBeGreaterThan(0);

    // Captures directory was created recursively
    expect(mkdirs.length).toBe(1);
    expect(mkdirs[0]).toMatch(/assets[\\/]+captures$/);

    // Browser cleanup happened
    expect(mocks.close).toHaveBeenCalled();
  });

  it('places the PNG under designId when provided', async () => {
    const { fs, writes } = makeFakeFs();
    const tool = makeCaptureElementTool({
      workspacePath: '/ws',
      designId: 'design-42',
      fs,
    });

    const result = await tool.execute(
      'id-1',
      { url: 'https://example.com', selector: '.card', format: 'png' },
      undefined,
    );

    expect(result.details.ok).toBe(true);
    expect(result.details.result?.pngPath).toMatch(/^design-42\/assets\/captures\/[a-f0-9]+\.png$/);
    expect(writes[0]?.path).toContain('design-42');
  });

  it('refuses PNG capture when no workspacePath is configured', async () => {
    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const result = await tool.execute(
      'id-1',
      { url: 'https://example.com', selector: '.card', format: 'png' },
      undefined,
    );
    expect(result.details.ok).toBe(false);
    expect(result.details.error).toMatch(/workspace/i);
    // Refusal happens before puppeteer touches the network.
    expect(mocks.launch).not.toHaveBeenCalled();
  });

  it('hashes URL+selector consistently across runs', async () => {
    const { fs, writes } = makeFakeFs();
    const tool = makeCaptureElementTool({
      workspacePath: '/ws',
      designId: null,
      fs,
    });

    await tool.execute(
      'id-1',
      { url: 'https://example.com', selector: '.card', format: 'png' },
      undefined,
    );
    await tool.execute(
      'id-2',
      { url: 'https://example.com', selector: '.card', format: 'png' },
      undefined,
    );

    expect(writes.length).toBe(2);
    expect(writes[0]?.path).toBe(writes[1]?.path);
  });
});

// ── DOM truncation ───────────────────────────────────────────────────────────

describe('DOM truncation', () => {
  beforeEach(() => {
    for (const key of Object.keys(mocks) as Array<keyof typeof mocks>) {
      mocks[key].mockReset();
    }
    installHappyPathMocks();
  });

  it('returns the DOM untruncated when under 32KB', async () => {
    mocks.evaluate.mockImplementation(async () => '<div>tiny</div>');

    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const result = await tool.execute(
      'id-1',
      { url: 'https://example.com', selector: '.x', format: 'dom' },
      undefined,
    );
    expect(result.details.ok).toBe(true);
    expect(result.details.result?.dom).toBe('<div>tiny</div>');
    expect(result.details.result?.dom).not.toContain('[truncated]');
  });

  it('truncates DOM > 32KB and adds the marker', async () => {
    // Build a string just over 32KB. Use ASCII so bytes === chars.
    const huge = 'x'.repeat(33 * 1024);
    mocks.evaluate.mockImplementation(async () => `<div>${huge}</div>`);

    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const result = await tool.execute(
      'id-1',
      { url: 'https://example.com', selector: '.x', format: 'dom' },
      undefined,
    );

    expect(result.details.ok).toBe(true);
    const dom = result.details.result?.dom ?? '';
    expect(dom.length).toBeLessThanOrEqual(32 * 1024);
    expect(dom).toContain('[truncated]');
  });
});

// ── Styles branch ────────────────────────────────────────────────────────────

describe('computed styles', () => {
  beforeEach(() => {
    for (const key of Object.keys(mocks) as Array<keyof typeof mocks>) {
      mocks[key].mockReset();
    }
    installHappyPathMocks();
  });

  it('returns the curated style map for format:styles', async () => {
    mocks.evaluate.mockImplementation(async (_fn, _el, keys) => {
      if (!Array.isArray(keys)) return '<div>x</div>';
      return {
        color: 'rgb(17, 17, 17)',
        'background-color': 'rgb(255, 255, 255)',
        'font-family': 'Inter, sans-serif',
      };
    });

    const tool = makeCaptureElementTool({ workspacePath: null, designId: null });
    const result = await tool.execute(
      'id-1',
      { url: 'https://example.com', selector: '.x', format: 'styles' },
      undefined,
    );

    expect(result.details.ok).toBe(true);
    expect(result.details.result?.styles).toMatchObject({
      color: 'rgb(17, 17, 17)',
      'font-family': 'Inter, sans-serif',
    });
  });
});
