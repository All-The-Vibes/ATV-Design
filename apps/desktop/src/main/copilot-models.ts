import { createHash } from 'node:crypto';
import {
  GITHUB_COPILOT_PROVIDER_ID,
  type ProviderCapabilities,
  type WireApi,
  modelsEndpointUrl,
  resolveProviderCapabilities,
} from '@atv-design/shared';
import { buildAuthHeadersForWire } from './auth-headers';
import { CONNECTION_FETCH_TIMEOUT_MS, fetchWithTimeout } from './connection-ipc';

const COPILOT_CACHE_TTL_MS = 5 * 60 * 1000;

type CopilotWire = Extract<WireApi, 'openai-chat' | 'openai-responses'>;

interface CachedCopilotModelEndpoints {
  endpointsByModel: Map<string, string[]>;
  expiresAt: number;
}

export interface CopilotTransportResolution {
  wire: CopilotWire;
  capabilities: Required<ProviderCapabilities>;
  explicitCapabilities: ProviderCapabilities | undefined;
  source: 'live-models' | 'heuristic';
  supportedEndpoints: string[];
}

const copilotModelEndpointCache = new Map<string, CachedCopilotModelEndpoints>();

function makeCopilotCacheKey(baseUrl: string, apiKey: string): string {
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
  return `${baseUrl}::${apiKeyHash}`;
}

function getCachedCopilotModelEndpoints(
  baseUrl: string,
  apiKey: string,
): Map<string, string[]> | null {
  const key = makeCopilotCacheKey(baseUrl, apiKey);
  const cached = copilotModelEndpointCache.get(key);
  if (cached === undefined) return null;
  if (Date.now() > cached.expiresAt) {
    copilotModelEndpointCache.delete(key);
    return null;
  }
  return cached.endpointsByModel;
}

function setCachedCopilotModelEndpoints(
  baseUrl: string,
  apiKey: string,
  endpointsByModel: Map<string, string[]>,
): void {
  const key = makeCopilotCacheKey(baseUrl, apiKey);
  copilotModelEndpointCache.set(key, {
    endpointsByModel,
    expiresAt: Date.now() + COPILOT_CACHE_TTL_MS,
  });
}

function sanitizeCopilotExplicitCapabilities(
  explicit: ProviderCapabilities | undefined,
): ProviderCapabilities | undefined {
  if (explicit === undefined) return undefined;
  const {
    supportsChatCompletions: _supportsChatCompletions,
    supportsResponsesApi: _supportsResponsesApi,
    supportsSystemRole: _supportsSystemRole,
    supportsDeveloperRole: _supportsDeveloperRole,
    supportsReasoning: _supportsReasoning,
    supportsToolCalling: _supportsToolCalling,
    ...rest
  } = explicit;
  return rest;
}

function normalizeSupportedEndpoints(endpoints: readonly string[] | undefined): string[] {
  if (endpoints === undefined) return [];
  return endpoints
    .filter((endpoint): endpoint is string => typeof endpoint === 'string' && endpoint.length > 0)
    .map((endpoint) => endpoint.trim())
    .filter((endpoint, index, values) => values.indexOf(endpoint) === index);
}

export function extractCopilotSupportedEndpoints(body: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (body === null || typeof body !== 'object') return out;

  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return out;

  for (const item of data) {
    if (item === null || typeof item !== 'object') continue;
    const record = item as { id?: unknown; supported_endpoints?: unknown };
    if (typeof record.id !== 'string' || !Array.isArray(record.supported_endpoints)) continue;
    out.set(record.id, normalizeSupportedEndpoints(record.supported_endpoints));
  }
  return out;
}

export function pickCopilotWireForModel(
  modelId: string,
  supportedEndpoints: readonly string[] | undefined,
): Pick<CopilotTransportResolution, 'wire' | 'source' | 'supportedEndpoints'> {
  const normalizedEndpoints = normalizeSupportedEndpoints(supportedEndpoints);
  if (normalizedEndpoints.includes('/responses')) {
    return {
      wire: 'openai-responses',
      source: 'live-models',
      supportedEndpoints: normalizedEndpoints,
    };
  }
  if (normalizedEndpoints.includes('/chat/completions')) {
    return {
      wire: 'openai-chat',
      source: 'live-models',
      supportedEndpoints: normalizedEndpoints,
    };
  }
  if (/^gpt-5(?:$|[-.])/i.test(modelId)) {
    return {
      wire: 'openai-responses',
      source: 'heuristic',
      supportedEndpoints: normalizedEndpoints,
    };
  }
  return {
    wire: 'openai-chat',
    source: 'heuristic',
    supportedEndpoints: normalizedEndpoints,
  };
}

async function fetchCopilotSupportedEndpoints(
  apiKey: string,
  baseUrl: string,
  httpHeaders: Record<string, string> | undefined,
): Promise<Map<string, string[]>> {
  const cached = getCachedCopilotModelEndpoints(baseUrl, apiKey);
  if (cached !== null) return cached;

  const url = modelsEndpointUrl(baseUrl, 'openai-chat');
  const headers = buildAuthHeadersForWire('openai-chat', apiKey, httpHeaders, baseUrl);
  const res = await fetchWithTimeout(url, { method: 'GET', headers }, CONNECTION_FETCH_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`Copilot /models returned HTTP ${res.status}`);
  }

  const body: unknown = await res.json();
  const endpointsByModel = extractCopilotSupportedEndpoints(body);
  setCachedCopilotModelEndpoints(baseUrl, apiKey, endpointsByModel);
  return endpointsByModel;
}

export async function resolveCopilotTransportForModel(input: {
  modelId: string;
  apiKey: string;
  baseUrl: string;
  httpHeaders?: Record<string, string> | undefined;
  explicitCapabilities?: ProviderCapabilities | undefined;
}): Promise<CopilotTransportResolution> {
  const sanitizedExplicitCapabilities = sanitizeCopilotExplicitCapabilities(
    input.explicitCapabilities,
  );

  let selected = pickCopilotWireForModel(input.modelId, undefined);
  try {
    const endpointsByModel = await fetchCopilotSupportedEndpoints(
      input.apiKey,
      input.baseUrl,
      input.httpHeaders,
    );
    selected = pickCopilotWireForModel(input.modelId, endpointsByModel.get(input.modelId));
  } catch {
    // Fall back to the heuristic when /models cannot be reached. This keeps
    // GPT-5 class Copilot models working even if model discovery is flaky.
  }

  return {
    ...selected,
    capabilities: resolveProviderCapabilities(GITHUB_COPILOT_PROVIDER_ID, {
      wire: selected.wire,
      baseUrl: input.baseUrl,
      requiresApiKey: false,
      capabilities: sanitizedExplicitCapabilities,
    }),
    explicitCapabilities: sanitizedExplicitCapabilities,
  };
}

export function _clearCopilotModelEndpointCache(): void {
  copilotModelEndpointCache.clear();
}
