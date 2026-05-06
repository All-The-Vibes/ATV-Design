import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import {
  CopilotTokenStore,
  type StoredCopilotAuth,
  buildAuthorizeUrl,
  exchangeCode,
  exchangeForSessionToken,
  generatePkce,
  startCallbackServer,
} from '@atv-design/providers/copilot-sdk';
import {
  CodesignError,
  type Config,
  ERROR_CODES,
  GITHUB_COPILOT_MODELS_HINT,
  GITHUB_COPILOT_PROVIDER_ID,
  type ProviderEntry,
  hydrateConfig,
} from '@atv-design/shared';
import { configDir, writeConfig } from './config';
import { app, ipcMain, shell } from './electron-runtime';
import { getLogger } from './logger';
import { getCachedConfig, setCachedConfig } from './onboarding-ipc';

const logger = getLogger('copilot-oauth-ipc');
const COPILOT_AUTH_FILENAME = 'copilot-auth.json';
const COPILOT_BASE_URL = 'https://api.githubcopilot.com';
const COPILOT_INTEGRATION_ID = 'vscode-chat';
const COPILOT_SESSION_SKEW_MS = 60_000;

export interface CopilotOAuthStatus {
  loggedIn: boolean;
  accountLabel?: string | null;
  githubScope: string | null;
  sessionExpiresAt: number | null;
}

export { GITHUB_COPILOT_PROVIDER_ID };

let tokenStoreSingleton: CopilotTokenStore | null = null;
let activeLoginAbortController: AbortController | null = null;
let activeLoginPromise: Promise<CopilotOAuthStatus> | null = null;

export function buildCopilotProviderEntry(): ProviderEntry {
  return {
    id: GITHUB_COPILOT_PROVIDER_ID,
    name: 'GitHub Copilot',
    builtin: false,
    wire: 'openai-chat',
    baseUrl: COPILOT_BASE_URL,
    defaultModel: GITHUB_COPILOT_MODELS_HINT[0],
    modelsHint: [...GITHUB_COPILOT_MODELS_HINT],
    httpHeaders: {
      'Editor-Version': `atv-design/${app.getVersion()}`,
      'Copilot-Integration-Id': COPILOT_INTEGRATION_ID,
    },
    requiresApiKey: false,
    capabilities: {
      supportsKeyless: true,
      supportsModelsEndpoint: false,
      modelDiscoveryMode: 'static-hint',
    },
  };
}

async function refreshStoredCopilotSessionToken(
  stored: StoredCopilotAuth,
): Promise<StoredCopilotAuth> {
  const session = await exchangeForSessionToken({
    githubAccessToken: stored.githubAccessToken,
  });
  return {
    ...stored,
    copilotSessionToken: session.token,
    copilotSessionExpiresAt: session.expiresAt,
    updatedAt: Date.now(),
  };
}

export function getCopilotTokenStore(): CopilotTokenStore {
  if (tokenStoreSingleton === null) {
    tokenStoreSingleton = new CopilotTokenStore({
      filePath: join(configDir(), COPILOT_AUTH_FILENAME),
      refreshFn: refreshStoredCopilotSessionToken,
    });
  }
  return tokenStoreSingleton;
}

export async function getCopilotSessionToken(): Promise<string> {
  const store = getCopilotTokenStore();
  const stored = await store.getCurrent();
  if (
    stored.copilotSessionToken !== null &&
    stored.copilotSessionExpiresAt !== null &&
    stored.copilotSessionExpiresAt > Date.now() + COPILOT_SESSION_SKEW_MS
  ) {
    return stored.copilotSessionToken;
  }

  const session = await exchangeForSessionToken({
    githubAccessToken: stored.githubAccessToken,
  });
  const refreshed = await store.save({
    githubAccessToken: stored.githubAccessToken,
    githubTokenType: stored.githubTokenType,
    githubScope: stored.githubScope,
    githubObtainedAt: stored.githubObtainedAt,
    copilotSessionToken: session.token,
    copilotSessionExpiresAt: session.expiresAt,
  });
  if (refreshed.copilotSessionToken === null || refreshed.copilotSessionToken.length === 0) {
    throw new CodesignError(
      'GitHub Copilot session token is missing after refresh',
      ERROR_CODES.PROVIDER_AUTH_MISSING,
    );
  }
  return refreshed.copilotSessionToken;
}

export function __resetCopilotTokenStoreForTests(): void {
  tokenStoreSingleton = null;
  activeLoginAbortController = null;
  activeLoginPromise = null;
}

function toStatus(stored: StoredCopilotAuth | null): CopilotOAuthStatus {
  if (stored === null) {
    return { loggedIn: false, accountLabel: null, githubScope: null, sessionExpiresAt: null };
  }
  return {
    loggedIn: stored.githubAccessToken.length > 0,
    accountLabel: stored.githubAccessToken.length > 0 ? 'GitHub Copilot' : null,
    githubScope: stored.githubScope,
    sessionExpiresAt: stored.copilotSessionExpiresAt,
  };
}

async function runStatus(): Promise<CopilotOAuthStatus> {
  const stored = await getCopilotTokenStore().load();
  return toStatus(stored);
}

async function persistProviderMutation(
  mutate: (providers: Record<string, ProviderEntry>) => Record<string, ProviderEntry>,
): Promise<void> {
  const cfg = getCachedConfig();
  const prevProviders: Record<string, ProviderEntry> = cfg?.providers ?? {};
  const nextProviders = mutate({ ...prevProviders });
  const next: Config = hydrateConfig({
    version: 3,
    activeProvider: cfg?.activeProvider ?? '',
    activeModel: cfg?.activeModel ?? '',
    secrets: cfg?.secrets ?? {},
    providers: nextProviders,
    ...(cfg?.designSystem !== undefined ? { designSystem: cfg.designSystem } : {}),
    ...(cfg?.imageGeneration !== undefined ? { imageGeneration: cfg.imageGeneration } : {}),
  });
  await writeConfig(next);
  setCachedConfig(next);
}

async function claimActiveProviderIfUnset(): Promise<void> {
  const cfg = getCachedConfig();
  if (cfg === null) return;
  const current = cfg.activeProvider;
  const hasValidActive =
    current !== undefined &&
    current !== null &&
    current !== '' &&
    cfg.providers[current] !== undefined;
  if (hasValidActive) return;
  const provider = buildCopilotProviderEntry();
  const next: Config = hydrateConfig({
    version: 3,
    activeProvider: GITHUB_COPILOT_PROVIDER_ID,
    activeModel: provider.defaultModel,
    secrets: cfg.secrets,
    providers: cfg.providers,
    ...(cfg.designSystem !== undefined ? { designSystem: cfg.designSystem } : {}),
    ...(cfg.imageGeneration !== undefined ? { imageGeneration: cfg.imageGeneration } : {}),
  });
  await writeConfig(next);
  setCachedConfig(next);
}

async function runLoginFlow(abortController: AbortController): Promise<CopilotOAuthStatus> {
  const pkce = generatePkce();
  const state = randomBytes(16).toString('hex');
  let server: Awaited<ReturnType<typeof startCallbackServer>> | null = null;
  try {
    server = await startCallbackServer();
    const authorizeUrl = buildAuthorizeUrl({
      redirectUri: server.redirectUri,
      state,
      challenge: pkce.challenge,
    });
    await shell.openExternal(authorizeUrl);
    logger.info('copilot.oauth.login.started', { redirectUri: server.redirectUri });
    const { code } = await server.waitForCode({ state, signal: abortController.signal });
    const token = await exchangeCode({
      code,
      verifier: pkce.verifier,
      redirectUri: server.redirectUri,
      signal: abortController.signal,
    });
    const stored = await getCopilotTokenStore().save({
      githubAccessToken: token.accessToken,
      githubTokenType: token.tokenType,
      githubScope: token.scope,
      githubObtainedAt: token.obtainedAt,
      copilotSessionToken: null,
      copilotSessionExpiresAt: null,
    });
    const provider = buildCopilotProviderEntry();
    await persistProviderMutation((providers) => {
      providers[GITHUB_COPILOT_PROVIDER_ID] = { ...provider };
      return providers;
    });
    await claimActiveProviderIfUnset();
    logger.info('copilot.oauth.login.ok', {
      hasScope: stored.githubScope.length > 0,
      hasSessionToken: stored.copilotSessionToken !== null,
    });
    return toStatus(stored);
  } catch (err) {
    if (abortController.signal.aborted) {
      logger.info('copilot.oauth.login.cancelled');
      throw new CodesignError('GitHub Copilot login cancelled', ERROR_CODES.PROVIDER_ABORTED, {
        cause: err,
      });
    }
    logger.error('copilot.oauth.login.fail', {
      message: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof CodesignError) throw err;
    throw new CodesignError(
      `GitHub Copilot login failed: ${err instanceof Error ? err.message : String(err)}`,
      ERROR_CODES.PROVIDER_ERROR,
      { cause: err },
    );
  } finally {
    await server?.close();
  }
}

async function runLogin(): Promise<CopilotOAuthStatus> {
  if (activeLoginPromise !== null) return activeLoginPromise;

  const abortController = new AbortController();
  activeLoginAbortController = abortController;

  const promise = runLoginFlow(abortController);
  const trackedPromise = promise.finally(() => {
    if (activeLoginAbortController === abortController) {
      activeLoginAbortController = null;
    }
    if (activeLoginPromise === trackedPromise) {
      activeLoginPromise = null;
    }
  });

  activeLoginPromise = trackedPromise;
  return trackedPromise;
}

async function runCancelLogin(): Promise<boolean> {
  if (activeLoginAbortController === null || activeLoginAbortController.signal.aborted) {
    return false;
  }
  activeLoginAbortController.abort();
  return true;
}

async function runLogout(): Promise<CopilotOAuthStatus> {
  await getCopilotTokenStore().clear();
  const cfg = getCachedConfig();
  if (cfg?.providers[GITHUB_COPILOT_PROVIDER_ID] !== undefined) {
    await persistProviderMutation((providers) => {
      delete providers[GITHUB_COPILOT_PROVIDER_ID];
      return providers;
    });
  }
  const cfgAfter = getCachedConfig();
  if (cfgAfter !== null && cfgAfter.activeProvider === GITHUB_COPILOT_PROVIDER_ID) {
    const next: Config = {
      ...cfgAfter,
      activeProvider: '',
      activeModel: '',
    };
    await writeConfig(next);
    setCachedConfig(next);
  }
  logger.info('copilot.oauth.logout.ok');
  return { loggedIn: false, accountLabel: null, githubScope: null, sessionExpiresAt: null };
}

export function registerCopilotOAuthIpc(): void {
  ipcMain.handle('copilot-oauth:v1:status', async (): Promise<CopilotOAuthStatus> => runStatus());
  ipcMain.handle('copilot-oauth:v1:login', async (): Promise<CopilotOAuthStatus> => runLogin());
  ipcMain.handle('copilot-oauth:v1:cancel-login', async (): Promise<boolean> => runCancelLogin());
  ipcMain.handle('copilot-oauth:v1:logout', async (): Promise<CopilotOAuthStatus> => runLogout());
}
