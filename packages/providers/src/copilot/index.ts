/**
 * copilot/index.ts — Thin entry point for selecting a GitHub Copilot backend.
 *
 * v0.2 ships ONLY the native OAuth backend (`copilot-sdk`). A `gh copilot` CLI
 * passthrough adapter was scoped during planning, but on inspection the
 * `gh copilot` CLI exposes only `suggest`/`explain` sub-commands — neither is
 * a general chat-completion surface and therefore cannot peer with the SDK
 * adapter for design-generation use cases. Removed in autopilot path A
 * (2026-05-01) to keep the surface honest.
 *
 * The selector is preserved as a thin wrapper rather than collapsed into
 * `copilot-sdk` so future backends (a sanctioned Copilot REST API, an Azure
 * AI Foundry passthrough, etc.) can be added without changing call sites.
 *
 * Hard constraints (CLAUDE.md):
 *  - No console.* in packages/providers/**.
 *  - exactOptionalPropertyTypes: true — inline conditional spread, no
 *    declared-then-mutated objects.
 *  - No `any`, no unnecessary `as` casts.
 *  - SDK adapter is lazy-loaded via dynamic import().
 */

import { ERROR_CODES } from '@open-codesign/shared';
import { CopilotProviderError } from '../copilot-sdk/errors.js';
import type { CopilotProviderHandle } from '../copilot-sdk/index.js';
import type { CopilotTokenStore } from '../copilot-sdk/token-store.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CopilotBackendKind = 'sdk';

export interface CopilotBackendAvailability {
  sdk: { available: boolean; reason?: string };
}

export interface ChooseCopilotOptions {
  /**
   * Explicit backend override. Currently only `'sdk'` is valid. Reserved for
   * future backend kinds — `OPEN_CODESIGN_COPILOT_BACKEND` is read from the
   * environment as a forward-compatibility hook.
   */
  backend?: CopilotBackendKind;
  /** Required for SDK backend. */
  tokenStore?: CopilotTokenStore;
  /**
   * Override for env-var detection. When set, takes the place of
   * `process.env['OPEN_CODESIGN_COPILOT_BACKEND']`.
   */
  envBackend?: string;
  logger?: {
    info: (key: string, fields?: Record<string, unknown>) => void;
    warn: (key: string, fields?: Record<string, unknown>) => void;
    error: (key: string, fields?: Record<string, unknown>) => void;
  };
}

export interface ChooseCopilotResult {
  backend: CopilotBackendKind;
  handle: CopilotProviderHandle;
  availability: CopilotBackendAvailability;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SDK_SIGN_IN_HINT = 'Sign in to GitHub Copilot via Settings → Copilot → Sign in';

const noopLogger: Required<NonNullable<ChooseCopilotOptions['logger']>> = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

// ---------------------------------------------------------------------------
// probeCopilotBackends — surface availability without selecting
// ---------------------------------------------------------------------------

export async function probeCopilotBackends(opts?: {
  tokenStore?: CopilotTokenStore;
  logger?: ChooseCopilotOptions['logger'];
}): Promise<CopilotBackendAvailability> {
  const logger = opts?.logger ?? noopLogger;
  const sdk = await probeSdk(opts?.tokenStore);
  logger.info('copilot.backend_probed', { sdkAvailable: sdk.available });
  return { sdk };
}

// ---------------------------------------------------------------------------
// chooseCopilot — select and lazy-load the backend
// ---------------------------------------------------------------------------

/**
 * Selects and lazy-loads a Copilot backend handle.
 *
 * Hard-fail policy: If `handle.complete()` fails mid-session, the caller
 * should surface the error and let the user re-invoke `chooseCopilot()`.
 * This module performs no automatic fallback or recovery.
 */
export async function chooseCopilot(opts: ChooseCopilotOptions): Promise<ChooseCopilotResult> {
  const logger = opts.logger ?? noopLogger;

  // 1. Resolve preference. Currently only 'sdk' is meaningful; unknown values
  //    are ignored (forward-compatible with future backends).
  const envRaw = opts.envBackend ?? process.env['OPEN_CODESIGN_COPILOT_BACKEND'];
  const envPreference: CopilotBackendKind | undefined = envRaw === 'sdk' ? envRaw : undefined;
  const preference: CopilotBackendKind | undefined = opts.backend ?? envPreference;

  if (preference !== undefined && preference !== 'sdk') {
    // Future-proofing: today this branch is unreachable because the type
    // narrows to 'sdk', but the env-var path could deliver garbage strings.
    logger.error('copilot.backend_unavailable', { backend: preference });
    throw backendUnavailableError(preference, 'unsupported backend kind', SDK_SIGN_IN_HINT);
  }

  const sdkProbe = await probeSdk(opts.tokenStore);
  if (!sdkProbe.available) {
    logger.error('copilot.backend_unavailable', { backend: 'sdk', reason: sdkProbe.reason });
    throw backendUnavailableError(
      'sdk',
      sdkProbe.reason ?? 'SDK backend not available',
      SDK_SIGN_IN_HINT,
    );
  }

  const handle = await loadSdkHandle(opts.tokenStore as CopilotTokenStore, logger);
  logger.info('copilot.backend_chosen', { backend: 'sdk' });
  return { backend: 'sdk', handle, availability: { sdk: sdkProbe } };
}

// ---------------------------------------------------------------------------
// Internal: SDK probe
// ---------------------------------------------------------------------------

async function probeSdk(
  tokenStore: CopilotTokenStore | undefined,
): Promise<{ available: boolean; reason?: string }> {
  if (tokenStore === undefined) {
    return { available: false, reason: 'tokenStore not configured' };
  }
  try {
    const stored = await tokenStore.load();
    if (stored === null) {
      return { available: false, reason: 'no stored credentials — sign in first' };
    }
    return { available: true };
  } catch {
    return { available: false, reason: 'failed to read token store' };
  }
}

// ---------------------------------------------------------------------------
// Internal: lazy-load SDK handle
// ---------------------------------------------------------------------------

async function loadSdkHandle(
  tokenStore: CopilotTokenStore,
  logger: NonNullable<ChooseCopilotOptions['logger']>,
): Promise<CopilotProviderHandle> {
  const mod = (await import('../copilot-sdk/index.js')) as {
    registerCopilotProvider: (opts: {
      tokenStore: CopilotTokenStore;
      logger?: NonNullable<ChooseCopilotOptions['logger']>;
    }) => CopilotProviderHandle;
  };
  return mod.registerCopilotProvider({ tokenStore, logger });
}

// ---------------------------------------------------------------------------
// Internal: error factory
// ---------------------------------------------------------------------------

function backendUnavailableError(
  backend: string,
  reason: string,
  remediationHint: string,
): CopilotProviderError {
  return new CopilotProviderError(
    `GitHub Copilot ${backend} backend is not available: ${reason}. ${remediationHint}`,
    {
      status: undefined,
      requestId: undefined,
      code: ERROR_CODES.COPILOT_BACKEND_UNAVAILABLE,
    },
  );
}
