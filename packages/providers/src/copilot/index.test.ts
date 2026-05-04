/**
 * Tests for packages/providers/src/copilot/index.ts
 *
 * v0.2 ships only the SDK backend. The CLI passthrough was scoped during
 * planning but removed in autopilot path A (2026-05-01) after discovering
 * `gh copilot` exposes only `suggest`/`explain` sub-commands — not a peer
 * chat-completion interface.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ERROR_CODES } from '@atv-design/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopilotProviderError } from '../copilot-sdk/errors.js';
import type { CopilotProviderHandle } from '../copilot-sdk/index.js';
import { CopilotTokenStore } from '../copilot-sdk/token-store.js';
import { chooseCopilot, probeCopilotBackends } from './index.js';

// ---------------------------------------------------------------------------
// Mock setup — SDK adapter is mocked so chooseCopilot() doesn't try to start
// a real loopback OAuth server.
// ---------------------------------------------------------------------------

const mockSdkHandle: CopilotProviderHandle = {
  signIn: vi.fn(),
  signOut: vi.fn(),
  isSignedIn: vi.fn().mockResolvedValue(true),
  complete: vi.fn(),
};

const mockRegisterSdk = vi.fn().mockReturnValue(mockSdkHandle);

vi.mock('../copilot-sdk/index.js', () => ({
  registerCopilotProvider: mockRegisterSdk,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let tokenStore: CopilotTokenStore;

const validAuth = {
  githubAccessToken: 'gho_test_token',
  githubTokenType: 'bearer',
  githubScope: 'copilot',
  githubObtainedAt: Date.now(),
  copilotSessionToken: null,
  copilotSessionExpiresAt: null,
} as const;

function makeLogger() {
  return {
    info: vi.fn<(key: string, fields?: Record<string, unknown>) => void>(),
    warn: vi.fn<(key: string, fields?: Record<string, unknown>) => void>(),
    error: vi.fn<(key: string, fields?: Record<string, unknown>) => void>(),
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'copilot-test-'));
  tokenStore = new CopilotTokenStore({ configDir: tmpDir });
  vi.clearAllMocks();
  mockRegisterSdk.mockReturnValue(mockSdkHandle);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  Reflect.deleteProperty(process.env, 'OPEN_CODESIGN_COPILOT_BACKEND');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chooseCopilot', () => {
  it('returns SDK handle when tokenStore has stored credentials', async () => {
    await tokenStore.save(validAuth);
    const result = await chooseCopilot({ tokenStore });

    expect(result.backend).toBe('sdk');
    expect(result.handle).toBe(mockSdkHandle);
    expect(result.availability.sdk.available).toBe(true);
    expect(mockRegisterSdk).toHaveBeenCalledWith(expect.objectContaining({ tokenStore }));
  });

  it('respects an explicit backend: "sdk" override', async () => {
    await tokenStore.save(validAuth);
    const result = await chooseCopilot({ backend: 'sdk', tokenStore });
    expect(result.backend).toBe('sdk');
  });

  it('throws COPILOT_BACKEND_UNAVAILABLE when no tokenStore is provided', async () => {
    await expect(chooseCopilot({})).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof CopilotProviderError && e.code === ERROR_CODES.COPILOT_BACKEND_UNAVAILABLE,
    );
  });

  it('throws COPILOT_BACKEND_UNAVAILABLE when tokenStore has no stored credentials', async () => {
    await expect(chooseCopilot({ tokenStore })).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof CopilotProviderError && e.code === ERROR_CODES.COPILOT_BACKEND_UNAVAILABLE,
    );
  });

  it('throws COPILOT_BACKEND_UNAVAILABLE when env-var preference is an unknown backend', async () => {
    await tokenStore.save(validAuth);
    // garbage env value should be ignored (typed pref stays undefined) AND fall through to SDK
    process.env['OPEN_CODESIGN_COPILOT_BACKEND'] = 'cli'; // legacy/future value
    const result = await chooseCopilot({ tokenStore });
    // 'cli' is no longer a valid backend kind → ignored → SDK chosen
    expect(result.backend).toBe('sdk');
  });

  it('opts.envBackend overrides process.env', async () => {
    await tokenStore.save(validAuth);
    process.env['OPEN_CODESIGN_COPILOT_BACKEND'] = 'cli';
    // opts.envBackend = 'sdk' wins; ignored garbage env doesn't matter
    const result = await chooseCopilot({ envBackend: 'sdk', tokenStore });
    expect(result.backend).toBe('sdk');
  });
});

describe('probeCopilotBackends', () => {
  it('reports SDK availability without selecting', async () => {
    await tokenStore.save(validAuth);
    const logger = makeLogger();

    const avail = await probeCopilotBackends({ tokenStore, logger });

    expect(avail.sdk.available).toBe(true);
    expect(mockRegisterSdk).not.toHaveBeenCalled();
    const infoKeys = logger.info.mock.calls.map(([k]) => k);
    expect(infoKeys).toContain('copilot.backend_probed');
  });

  it('reports SDK unavailable when no tokenStore is provided', async () => {
    const avail = await probeCopilotBackends({});
    expect(avail.sdk.available).toBe(false);
    expect(avail.sdk.reason).toMatch(/tokenStore not configured/);
  });
});

describe('O1 structured log keys', () => {
  it('fires copilot.backend_chosen and never logs token values', async () => {
    await tokenStore.save(validAuth);
    const logger = makeLogger();

    await chooseCopilot({ tokenStore, logger });

    const allCalls = [
      ...logger.info.mock.calls,
      ...logger.warn.mock.calls,
      ...logger.error.mock.calls,
    ];

    for (const [key, fields] of allCalls) {
      expect(key).toMatch(/^copilot\./);
      const fieldStr = JSON.stringify(fields ?? {});
      expect(fieldStr).not.toContain('gho_');
      expect(fieldStr).not.toContain(validAuth.githubAccessToken);
    }

    const infoKeys = logger.info.mock.calls.map(([k]) => k);
    expect(infoKeys).toContain('copilot.backend_chosen');
  });

  it('fires copilot.backend_unavailable when SDK is not available', async () => {
    const logger = makeLogger();
    await expect(chooseCopilot({ logger })).rejects.toThrow(CopilotProviderError);
    const errorKeys = logger.error.mock.calls.map(([k]) => k);
    expect(errorKeys).toContain('copilot.backend_unavailable');
  });
});
