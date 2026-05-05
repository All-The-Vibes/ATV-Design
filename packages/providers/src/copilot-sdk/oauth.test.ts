import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopilotProviderError } from './errors.js';
import { AUTHORIZE_URL, SCOPE, buildAuthorizeUrl, exchangeCode, generatePkce } from './oauth.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(process.env, 'ATV_DESIGN_GITHUB_CLIENT_ID');
  Reflect.deleteProperty(process.env, 'OPEN_CODESIGN_GITHUB_CLIENT_ID');
});

// ---------------------------------------------------------------------------
// generatePkce
// ---------------------------------------------------------------------------

describe('generatePkce', () => {
  it('returns method S256', () => {
    const pair = generatePkce();
    expect(pair.method).toBe('S256');
  });

  it('verifier is 43–128 chars matching base64url alphabet', () => {
    const { verifier } = generatePkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('challenge equals base64url(sha256(verifier))', () => {
    const { verifier, challenge } = generatePkce();
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('produces unique verifiers on each call', () => {
    const a = generatePkce();
    const b = generatePkce();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });
});

// ---------------------------------------------------------------------------
// buildAuthorizeUrl
// ---------------------------------------------------------------------------

describe('buildAuthorizeUrl', () => {
  it('points at github.com/login/oauth/authorize', () => {
    const url = buildAuthorizeUrl({
      redirectUri: 'http://127.0.0.1:12345/oauth-callback',
      state: 'state-xyz',
      challenge: 'chal-abc',
    });
    expect(url.startsWith(`${AUTHORIZE_URL}?`)).toBe(true);
  });

  it('includes all required PKCE + OAuth params', () => {
    const url = buildAuthorizeUrl({
      redirectUri: 'http://127.0.0.1:12345/oauth-callback',
      state: 'state-xyz',
      challenge: 'chal-abc',
    });
    const params = new URL(url).searchParams;
    expect(params.get('client_id')).toBeTruthy();
    expect(params.get('redirect_uri')).toBe('http://127.0.0.1:12345/oauth-callback');
    expect(params.get('state')).toBe('state-xyz');
    expect(params.get('code_challenge')).toBe('chal-abc');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('scope')).toBe(SCOPE);
  });

  it('does NOT include client_secret', () => {
    const url = buildAuthorizeUrl({
      redirectUri: 'http://127.0.0.1:12345/oauth-callback',
      state: 's',
      challenge: 'c',
    });
    expect(url).not.toContain('client_secret');
    expect(new URL(url).searchParams.has('client_secret')).toBe(false);
  });

  it('accepts an explicit clientId override', () => {
    const url = buildAuthorizeUrl({
      redirectUri: 'http://127.0.0.1:12345/oauth-callback',
      state: 's',
      challenge: 'c',
      clientId: 'Iv1.explicit',
    });
    expect(new URL(url).searchParams.get('client_id')).toBe('Iv1.explicit');
  });
});

// ---------------------------------------------------------------------------
// exchangeCode
// ---------------------------------------------------------------------------

describe('exchangeCode', () => {
  it('happy path: parses token response and sets obtainedAt', async () => {
    const now = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ access_token: 'ghu_abc', token_type: 'bearer', scope: 'read:user' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    const result = await exchangeCode({
      code: 'c',
      verifier: 'v',
      redirectUri: 'http://127.0.0.1:9999/oauth-callback',
    });

    expect(result.accessToken).toBe('ghu_abc');
    expect(result.tokenType).toBe('bearer');
    expect(result.scope).toBe('read:user');
    expect(result.obtainedAt).toBe(now);
  });

  it('POSTs to TOKEN_URL (github.com/login/oauth/access_token)', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        capturedUrl = url;
        return new Response(
          JSON.stringify({ access_token: 'x', token_type: 'bearer', scope: '' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    await exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'r' });
    expect(capturedUrl).toBe('https://github.com/login/oauth/access_token');
  });

  it('form body contains exactly client_id, code, code_verifier, redirect_uri and NOT client_secret', async () => {
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedInit = init;
        return new Response(
          JSON.stringify({ access_token: 'x', token_type: 'bearer', scope: '' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    await exchangeCode({
      code: 'mycode',
      verifier: 'myverifier',
      redirectUri: 'http://127.0.0.1:9/oauth-callback',
    });

    const body = new URLSearchParams(capturedInit?.body as string);
    // Required fields
    expect(body.get('client_id')).toBeTruthy();
    expect(body.get('code')).toBe('mycode');
    expect(body.get('code_verifier')).toBe('myverifier');
    expect(body.get('redirect_uri')).toBe('http://127.0.0.1:9/oauth-callback');
    // Must NOT contain client_secret
    expect(body.has('client_secret')).toBe(false);
  });

  it('throws CopilotProviderError with status 401 on 401 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Unauthorized', { status: 401 })),
    );

    await expect(exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'r' })).rejects.toSatisfy(
      (err: unknown) => {
        return err instanceof CopilotProviderError && err.status === 401;
      },
    );
  });

  it('throws CopilotProviderError on 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Forbidden', { status: 403 })),
    );

    await expect(
      exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'r' }),
    ).rejects.toBeInstanceOf(CopilotProviderError);
  });

  it('throws CopilotProviderError on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    await expect(
      exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'r' }),
    ).rejects.toBeInstanceOf(CopilotProviderError);
  });

  it('env override: ATV_DESIGN_GITHUB_CLIENT_ID is used when no explicit clientId given', async () => {
    const original = process.env['ATV_DESIGN_GITHUB_CLIENT_ID'];
    process.env['ATV_DESIGN_GITHUB_CLIENT_ID'] = 'Iv1.testoverride';

    let capturedInit: RequestInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedInit = init;
        return new Response(
          JSON.stringify({ access_token: 'x', token_type: 'bearer', scope: '' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    try {
      await exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'r' });
      const body = new URLSearchParams(capturedInit?.body as string);
      expect(body.get('client_id')).toBe('Iv1.testoverride');
    } finally {
      process.env['ATV_DESIGN_GITHUB_CLIENT_ID'] = original;
    }
  });

  it('legacy OPEN_CODESIGN_GITHUB_CLIENT_ID remains a compatibility fallback', async () => {
    Reflect.deleteProperty(process.env, 'ATV_DESIGN_GITHUB_CLIENT_ID');
    const original = process.env['OPEN_CODESIGN_GITHUB_CLIENT_ID'];
    process.env['OPEN_CODESIGN_GITHUB_CLIENT_ID'] = 'Iv1.legacyoverride';

    let capturedInit: RequestInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedInit = init;
        return new Response(
          JSON.stringify({ access_token: 'x', token_type: 'bearer', scope: '' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    try {
      await exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'r' });
      const body = new URLSearchParams(capturedInit?.body as string);
      expect(body.get('client_id')).toBe('Iv1.legacyoverride');
    } finally {
      process.env['OPEN_CODESIGN_GITHUB_CLIENT_ID'] = original;
    }
  });

  it('explicit clientId overrides env', async () => {
    const originalAtv = process.env['ATV_DESIGN_GITHUB_CLIENT_ID'];
    const originalLegacy = process.env['OPEN_CODESIGN_GITHUB_CLIENT_ID'];
    process.env['ATV_DESIGN_GITHUB_CLIENT_ID'] = 'Iv1.fromenv';
    process.env['OPEN_CODESIGN_GITHUB_CLIENT_ID'] = 'Iv1.legacy';
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedInit = init;
        return new Response(
          JSON.stringify({ access_token: 'x', token_type: 'bearer', scope: '' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    try {
      await exchangeCode({ code: 'c', verifier: 'v', redirectUri: 'r', clientId: 'Iv1.explicit' });
      const body = new URLSearchParams(capturedInit?.body as string);
      expect(body.get('client_id')).toBe('Iv1.explicit');
    } finally {
      if (originalAtv === undefined) {
        Reflect.deleteProperty(process.env, 'ATV_DESIGN_GITHUB_CLIENT_ID');
      } else {
        process.env['ATV_DESIGN_GITHUB_CLIENT_ID'] = originalAtv;
      }
      if (originalLegacy === undefined) {
        Reflect.deleteProperty(process.env, 'OPEN_CODESIGN_GITHUB_CLIENT_ID');
      } else {
        process.env['OPEN_CODESIGN_GITHUB_CLIENT_ID'] = originalLegacy;
      }
    }
  });
});
