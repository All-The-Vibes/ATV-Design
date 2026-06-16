import { AzureEntraTokenStore } from '@atv-design/providers/azure';
import { CodesignError, ERROR_CODES } from '@atv-design/shared';
import { AzureCliCredential, ChainedTokenCredential, type TokenCredential } from '@azure/identity';
import { getLogger } from './logger';

const logger = getLogger('azure-identity');

/**
 * Azure Entra ID auth for Azure OpenAI / AI Foundry.
 *
 * Foundry resources commonly set `disableLocalAuth: true`, so api-key auth is
 * rejected and we must present a Microsoft Entra bearer token
 * (scope `https://cognitiveservices.azure.com/.default`). We acquire it via
 * @azure/identity — primarily the Azure CLI credential (the developer's `az
 * login` session), which needs no app registration or interactive flow inside
 * the Electron app. @azure/identity owns the real token cache + refresh; our
 * AzureEntraTokenStore is a thin per-process cache with a 5-min skew buffer so
 * the agent's per-turn getApiKey() hook stays cheap.
 *
 * The minted token is injected as `Authorization: Bearer …` (see provider
 * request assembly), NOT as an api-key — Foundry rejects an Entra token in the
 * api-key header (verified: 401).
 */

const COGNITIVE_SERVICES_SCOPE = 'https://cognitiveservices.azure.com/.default';

let credentialSingleton: TokenCredential | null = null;
let storeSingleton: AzureEntraTokenStore | null = null;

function getCredential(): TokenCredential {
  if (credentialSingleton === null) {
    // AzureCliCredential first: zero-config, uses the user's existing `az
    // login`. Chained so future credentials (managed identity, device code)
    // can be appended without changing callers.
    credentialSingleton = new ChainedTokenCredential(new AzureCliCredential());
  }
  return credentialSingleton;
}

export function getAzureTokenStore(): AzureEntraTokenStore {
  if (storeSingleton === null) {
    storeSingleton = new AzureEntraTokenStore({
      getToken: async () => {
        const credential = getCredential();
        const token = await credential.getToken(COGNITIVE_SERVICES_SCOPE);
        if (token === null) {
          throw new CodesignError(
            'Azure sign-in required. Run `az login` (or configure an Azure credential) to use the Azure OpenAI provider.',
            ERROR_CODES.PROVIDER_AUTH_MISSING,
          );
        }
        return { token: token.token, expiresOnTimestamp: token.expiresOnTimestamp };
      },
    });
  }
  return storeSingleton;
}

/** Returns a valid Entra bearer token, refreshing within the skew buffer. */
export async function getAzureAccessToken(): Promise<string> {
  try {
    return await getAzureTokenStore().getValidAccessToken();
  } catch (err) {
    logger.warn('azure.token.acquire_failed', {
      reason: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** Test seam: reset the singletons between unit tests. */
export function __resetAzureIdentityForTests(): void {
  credentialSingleton = null;
  storeSingleton = null;
}
