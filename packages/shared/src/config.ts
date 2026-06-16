import { z } from 'zod';

// ── Legacy enum (v1/v2) — kept for backward compat & UI shortlist ─────────────

const ProviderIdEnum = z.enum([
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'groq',
  'cerebras',
  'xai',
  'mistral',
  'amazon-bedrock',
  'azure-openai-responses',
  'vercel-ai-gateway',
]);

export const SUPPORTED_ONBOARDING_PROVIDERS = [
  'anthropic',
  'openai',
  'openrouter',
  'ollama',
] as const;
export type SupportedOnboardingProvider = (typeof SUPPORTED_ONBOARDING_PROVIDERS)[number];

/** Default Ollama local endpoint. Users override via Settings if they run
 *  Ollama on a different host/port. */
export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';
export const OLLAMA_DEFAULT_MODEL = 'llama3.2';

// ── Wire types (v3) ──────────────────────────────────────────────────────────

export const WireApiSchema = z.enum([
  'openai-chat',
  'openai-responses',
  'anthropic',
  'openai-codex-responses',
  // Azure OpenAI / AI Foundry. Routed to pi-ai's native `azure-openai-responses`
  // provider, which wraps the official AzureOpenAI SDK so the
  // `/openai/deployments/{deployment}/responses?api-version=…` URL is built
  // correctly. The plain `openai-chat` wire cannot serve Azure: the OpenAI SDK
  // appends `/chat/completions` AFTER any baseUrl query string, corrupting the
  // required api-version param (verified empirically).
  'azure-openai-responses',
]);
export type WireApi = z.infer<typeof WireApiSchema>;

/**
 * System-managed provider id for ChatGPT subscription (OAuth). Lives in
 * shared so both the desktop main process (which owns the OAuth flow and
 * writes the ProviderEntry) and peripheral helpers (e.g. keyless-allowed
 * checks in `provider-settings`) reference the same literal without
 * introducing import cycles.
 */
export const CHATGPT_CODEX_PROVIDER_ID = 'chatgpt-codex';
export const GITHUB_COPILOT_PROVIDER_ID = 'github-copilot';
/**
 * System-managed provider id for Azure OpenAI / AI Foundry via Entra ID.
 * Authenticates with a per-turn-refreshed Microsoft Entra bearer token
 * (scope `https://cognitiveservices.azure.com/.default`) injected as
 * `Authorization: Bearer …`, since Foundry resources commonly disable
 * api-key auth (`disableLocalAuth: true`). Treated as a dynamic-bearer
 * provider, like Copilot and Codex.
 */
export const AZURE_OPENAI_PROVIDER_ID = 'azure-openai';
/**
 * Azure api-version for the Responses API. pi-ai's azure provider normalizes
 * the base URL to the `/openai/v1` path, which accepts ONLY `api-version=preview`
 * (or none) — dated versions like `2025-04-01-preview` return 400 "API version
 * not supported" on that path. Verified against a live Foundry resource.
 */
export const AZURE_OPENAI_DEFAULT_API_VERSION = 'preview';
export const GITHUB_COPILOT_MODELS_HINT = [
  'gpt-5.5',
  'claude-opus-4.7',
  'gemini-3.1-pro-preview',
] as const;

// ── Secrets & StoredDesignSystem ─────────────────────────────────────────────

export const SecretRef = z.object({
  ciphertext: z.string().min(1),
  /**
   * Display-only mask like "sk-ant-***xyz9". Persisted at save time so the
   * Settings page can render the row without calling `safeStorage.decryptString`
   * (which on unsigned macOS builds triggers a keychain password prompt).
   * Optional for backwards compat: older configs without a mask will be
   * migrated on first read by decrypting once and writing the mask back.
   */
  mask: z.string().optional(),
});
export type SecretRef = z.infer<typeof SecretRef>;

export const BaseUrlRef = z.object({
  baseUrl: z.string().url(),
});
export type BaseUrlRef = z.infer<typeof BaseUrlRef>;

export const STORED_DESIGN_SYSTEM_SCHEMA_VERSION = 1 as const;

/**
 * Where the design system came from. Drives the "Source:" badge and decides
 * which import-button path replaces it. Optional for back-compat with v1
 * snapshots written before this field existed (they're treated as 'folder').
 */
export const StoredDesignSystemSourceSchema = z.object({
  kind: z.enum(['folder', 'url', 'files', 'builtIn']),
  value: z.string().min(1).optional(),
});
export type StoredDesignSystemSource = z.infer<typeof StoredDesignSystemSourceSchema>;

/**
 * A single component rule in the design system. `name` is the component label
 * (e.g. "Buttons", "Cards"); `rule` is a short prose paragraph describing the
 * visual/interaction contract; `screenshotPath` is an optional absolute path
 * to a reference image for the agent runtime to consume. Kept thin on
 * purpose — richer schemas (variants, states, props) can be added later
 * without breaking v1 configs.
 */
export const StoredDesignComponentSchema = z.object({
  name: z.string().min(1).max(64),
  rule: z.string().min(1).max(1024),
  screenshotPath: z.string().min(1).optional(),
});
export type StoredDesignComponent = z.infer<typeof StoredDesignComponentSchema>;

const StoredDesignSystemShape = z.object({
  schemaVersion: z.literal(STORED_DESIGN_SYSTEM_SCHEMA_VERSION),
  rootPath: z.string().min(1),
  summary: z.string().min(1),
  extractedAt: z.string().min(1),
  sourceFiles: z.array(z.string().min(1)).max(24).default([]),
  colors: z.array(z.string().min(1)).max(24).default([]),
  fonts: z.array(z.string().min(1)).max(16).default([]),
  spacing: z.array(z.string().min(1)).max(16).default([]),
  radius: z.array(z.string().min(1)).max(16).default([]),
  shadows: z.array(z.string().min(1)).max(16).default([]),
  // ── Additive fields (optional for back-compat with v1 configs) ─────────────
  /** Where the snapshot was extracted from. Optional for v1 configs that
   *  predate the field; renderer falls back to `{ kind: 'folder' }`. */
  source: StoredDesignSystemSourceSchema.optional(),
  /** Human-friendly name shown in the tab header. Defaults to basename(rootPath). */
  displayName: z.string().min(1).optional(),
  /** Whether this snapshot is the bundled "ATV default". User edits to a
   *  built-in snapshot fork it to a user-owned one (isBuiltIn becomes false). */
  isBuiltIn: z.boolean().optional(),
  /** Free-form notes — populated when the user edits tokens by hand so we can
   *  show a "Customized" marker without comparing the whole array. */
  userEdited: z.boolean().optional(),
  /** Component rules — the third Claude-Design pillar alongside colors and
   *  typography. Optional and capped to keep the snapshot small; richer
   *  per-component data lives in the workspace DESIGN.md, not config.toml. */
  components: z.array(StoredDesignComponentSchema).max(24).optional(),
});

export const StoredDesignSystem = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if ('schemaVersion' in record) return record;
  return { schemaVersion: STORED_DESIGN_SYSTEM_SCHEMA_VERSION, ...record };
}, StoredDesignSystemShape);
export type StoredDesignSystem = z.infer<typeof StoredDesignSystem>;

/**
 * Partial token patch sent across IPC for inline edits. Each array, if
 * provided, REPLACES that token category wholesale. The main process is
 * responsible for re-deriving `summary` and `extractedAt` after applying.
 *
 * `summary`, `displayName`, and `userEdited` may also be patched directly so
 * the renderer can rename a system or flip the edited marker. `rootPath`,
 * `source`, `isBuiltIn`, `extractedAt`, `schemaVersion`, and `sourceFiles`
 * are immutable from the renderer.
 */
export const DesignSystemTokenPatchSchema = z.object({
  colors: z.array(z.string().min(1)).max(24).optional(),
  fonts: z.array(z.string().min(1)).max(16).optional(),
  spacing: z.array(z.string().min(1)).max(16).optional(),
  radius: z.array(z.string().min(1)).max(16).optional(),
  shadows: z.array(z.string().min(1)).max(16).optional(),
  components: z.array(StoredDesignComponentSchema).max(24).optional(),
  summary: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
});
export type DesignSystemTokenPatch = z.infer<typeof DesignSystemTokenPatchSchema>;

// ── ProviderEntry (v3) ───────────────────────────────────────────────────────

export const ReasoningLevelSchema = z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']);
export type ReasoningLevel = z.infer<typeof ReasoningLevelSchema>;

export const ProviderModelDiscoveryModeSchema = z.enum(['models', 'static-hint', 'manual']);
export type ProviderModelDiscoveryMode = z.infer<typeof ProviderModelDiscoveryModeSchema>;

export const ProviderCapabilitiesSchema = z.object({
  supportsKeyless: z.boolean().optional(),
  supportsModelsEndpoint: z.boolean().optional(),
  supportsChatCompletions: z.boolean().optional(),
  supportsResponsesApi: z.boolean().optional(),
  supportsSystemRole: z.boolean().optional(),
  supportsDeveloperRole: z.boolean().optional(),
  supportsReasoning: z.boolean().optional(),
  supportsToolCalling: z.boolean().optional(),
  requiresClaudeCodeIdentity: z.boolean().optional(),
  modelDiscoveryMode: ProviderModelDiscoveryModeSchema.optional(),
});
export type ProviderCapabilities = z.infer<typeof ProviderCapabilitiesSchema>;

export const IMAGE_GENERATION_SCHEMA_VERSION = 1 as const;

export const ImageGenerationProviderSchema = z.enum(['openai', 'openrouter']);
export type ImageGenerationProvider = z.infer<typeof ImageGenerationProviderSchema>;

export const ImageGenerationCredentialModeSchema = z.enum(['inherit', 'custom']);
export type ImageGenerationCredentialMode = z.infer<typeof ImageGenerationCredentialModeSchema>;

export const ImageGenerationQualitySchema = z.enum(['auto', 'low', 'medium', 'high']);
export type ImageGenerationQuality = z.infer<typeof ImageGenerationQualitySchema>;

export const ImageGenerationSizeSchema = z.enum(['auto', '1024x1024', '1536x1024', '1024x1536']);
export type ImageGenerationSize = z.infer<typeof ImageGenerationSizeSchema>;

export const ImageGenerationOutputFormatSchema = z.enum(['png', 'jpeg', 'webp']);
export type ImageGenerationOutputFormat = z.infer<typeof ImageGenerationOutputFormatSchema>;

export const ImageGenerationSettingsSchema = z.object({
  schemaVersion: z.literal(IMAGE_GENERATION_SCHEMA_VERSION),
  enabled: z.boolean().default(false),
  provider: ImageGenerationProviderSchema.default('openai'),
  credentialMode: ImageGenerationCredentialModeSchema.default('inherit'),
  model: z.string().min(1).default('gpt-image-2'),
  baseUrl: z.string().url().optional(),
  apiKey: SecretRef.optional(),
  quality: ImageGenerationQualitySchema.default('high'),
  size: ImageGenerationSizeSchema.default('1536x1024'),
  outputFormat: ImageGenerationOutputFormatSchema.default('png'),
});
export type ImageGenerationSettings = z.infer<typeof ImageGenerationSettingsSchema>;

export const ProviderEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  builtin: z.boolean(),
  wire: WireApiSchema,
  baseUrl: z.string().url(),
  envKey: z.string().min(1).optional(),
  defaultModel: z.string().min(1),
  modelsHint: z.array(z.string()).optional(),
  httpHeaders: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.string()).optional(),
  /**
   * Imported providers can explicitly require a stored secret. Codex uses this
   * for providers with `requires_openai_auth = true`; providers without it may
   * still be keyless proxy endpoints.
   */
  requiresApiKey: z.boolean().optional(),
  /**
   * Per-provider reasoning effort override. When set, overrides the
   * model-family default from `reasoningForModel` in core. Useful for
   * proxies that gate reasoning tiers by plan (Claude Code consumer-tier
   * accepts only 'medium') or for users who want to dial depth up/down
   * per endpoint. The UI surfaces this as a "Reasoning depth" dropdown.
   */
  reasoningLevel: ReasoningLevelSchema.optional(),
  capabilities: ProviderCapabilitiesSchema.optional(),
});
export type ProviderEntry = z.infer<typeof ProviderEntrySchema>;

interface ProviderCapabilityInput {
  wire: WireApi;
  baseUrl?: string | undefined;
  requiresApiKey?: boolean | undefined;
  modelsHint?: string[] | undefined;
  reasoningLevel?: ReasoningLevel | undefined;
  capabilities?: ProviderCapabilities | undefined;
}

function isAnthropicOfficialHost(baseUrl: string | undefined): boolean {
  if (baseUrl === undefined || baseUrl.length === 0) return true;
  let host: string;
  try {
    host = new URL(baseUrl).host.toLowerCase();
  } catch {
    return false;
  }
  const normalized = host.replace(/:(?:80|443)$/, '');
  return normalized === 'api.anthropic.com' || normalized.endsWith('.anthropic.com');
}

export function defaultProviderCapabilities(
  _providerId: string,
  entry: ProviderCapabilityInput,
): Required<ProviderCapabilities> {
  const supportsModelsEndpoint =
    entry.capabilities?.supportsModelsEndpoint ?? entry.wire !== 'openai-codex-responses';
  const wire = entry.wire;
  return {
    supportsKeyless: entry.requiresApiKey === false,
    supportsModelsEndpoint,
    supportsChatCompletions: wire === 'openai-chat',
    supportsResponsesApi: wire === 'openai-responses' || wire === 'openai-codex-responses',
    supportsSystemRole: wire !== 'openai-responses' && wire !== 'openai-codex-responses',
    supportsDeveloperRole: wire === 'openai-responses' || wire === 'openai-codex-responses',
    supportsReasoning:
      entry.reasoningLevel !== undefined ||
      wire === 'anthropic' ||
      wire === 'openai-responses' ||
      wire === 'openai-codex-responses',
    supportsToolCalling:
      wire === 'anthropic' || wire === 'openai-chat' || wire === 'openai-responses',
    requiresClaudeCodeIdentity: wire === 'anthropic' && !isAnthropicOfficialHost(entry.baseUrl),
    modelDiscoveryMode:
      entry.modelsHint !== undefined ? 'static-hint' : supportsModelsEndpoint ? 'models' : 'manual',
  };
}

export function resolveProviderCapabilities(
  providerId: string,
  entry: ProviderCapabilityInput,
): Required<ProviderCapabilities> {
  const defaults = defaultProviderCapabilities(providerId, entry);
  const explicit = entry.capabilities ?? {};
  return {
    supportsKeyless: explicit.supportsKeyless ?? defaults.supportsKeyless,
    supportsModelsEndpoint: explicit.supportsModelsEndpoint ?? defaults.supportsModelsEndpoint,
    supportsChatCompletions: explicit.supportsChatCompletions ?? defaults.supportsChatCompletions,
    supportsResponsesApi: explicit.supportsResponsesApi ?? defaults.supportsResponsesApi,
    supportsSystemRole: explicit.supportsSystemRole ?? defaults.supportsSystemRole,
    supportsDeveloperRole: explicit.supportsDeveloperRole ?? defaults.supportsDeveloperRole,
    supportsReasoning: explicit.supportsReasoning ?? defaults.supportsReasoning,
    supportsToolCalling: explicit.supportsToolCalling ?? defaults.supportsToolCalling,
    requiresClaudeCodeIdentity:
      explicit.requiresClaudeCodeIdentity ?? defaults.requiresClaudeCodeIdentity,
    modelDiscoveryMode: explicit.modelDiscoveryMode ?? defaults.modelDiscoveryMode,
  };
}

/** Alias for `Required<ProviderCapabilities>` — all capability fields resolved. */
export type ResolvedProviderCapabilities = Required<ProviderCapabilities>;

export const BUILTIN_PROVIDERS: Readonly<Record<SupportedOnboardingProvider, ProviderEntry>> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    builtin: true,
    wire: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    capabilities: {
      supportsKeyless: false,
      supportsModelsEndpoint: true,
      supportsChatCompletions: false,
      supportsResponsesApi: false,
      supportsSystemRole: true,
      supportsDeveloperRole: false,
      supportsReasoning: true,
      supportsToolCalling: true,
      requiresClaudeCodeIdentity: false,
      modelDiscoveryMode: 'models',
    },
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    builtin: true,
    wire: 'openai-chat',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    capabilities: {
      supportsKeyless: false,
      supportsModelsEndpoint: true,
      supportsChatCompletions: true,
      supportsResponsesApi: false,
      supportsSystemRole: true,
      supportsDeveloperRole: false,
      supportsReasoning: false,
      supportsToolCalling: true,
      requiresClaudeCodeIdentity: false,
      modelDiscoveryMode: 'models',
    },
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    builtin: true,
    wire: 'openai-chat',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4.6',
    capabilities: {
      supportsKeyless: false,
      supportsModelsEndpoint: true,
      supportsChatCompletions: true,
      supportsResponsesApi: false,
      supportsSystemRole: true,
      supportsDeveloperRole: false,
      supportsReasoning: false,
      supportsToolCalling: true,
      requiresClaudeCodeIdentity: false,
      modelDiscoveryMode: 'models',
    },
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (local)',
    builtin: true,
    wire: 'openai-chat',
    baseUrl: OLLAMA_DEFAULT_BASE_URL,
    defaultModel: OLLAMA_DEFAULT_MODEL,
    requiresApiKey: false,
    capabilities: {
      supportsKeyless: true,
      supportsModelsEndpoint: true,
      supportsChatCompletions: true,
      supportsResponsesApi: false,
      supportsSystemRole: true,
      supportsDeveloperRole: false,
      supportsReasoning: false,
      supportsToolCalling: true,
      requiresClaudeCodeIdentity: false,
      modelDiscoveryMode: 'models',
    },
  },
} as const;

// ── ConfigSchema v3 — canonical on-disk shape ────────────────────────────────

/**
 * Canonical v3 config shape written to disk. All `writeConfig` calls emit
 * exactly this shape. Reads accept v1/v2 as well (see `parseConfigFlexible`),
 * migrating transparently.
 *
 * The `Config` TypeScript type additionally exposes legacy `provider` /
 * `modelPrimary` / `baseUrls` accessors as read-only derived views — existing
 * consumers keep working without rewrites. These derived fields are NOT
 * persisted. Writers must use v3 fields only.
 */
export const ConfigV3Schema = z.object({
  version: z.literal(3),
  // `activeProvider` / `activeModel` are ALLOWED to be empty: that's the
  // legal "no active provider" state the app lands in once the last
  // provider is deleted. Consumers (`toState`, `resolveActiveCredentials`,
  // Settings UI) already branch on hasKey/undefined-entry for this case.
  // The previous `.min(1)` invariant made the empty state unrepresentable
  // on disk — writing it succeeded but the next boot rejected the file,
  // hanging the main process before the window could open.
  activeProvider: z.string(),
  activeModel: z.string(),
  secrets: z.record(z.string(), SecretRef).default({}),
  providers: z.record(z.string(), ProviderEntrySchema).default({}),
  designSystem: StoredDesignSystem.optional(),
  imageGeneration: ImageGenerationSettingsSchema.optional(),
});
export type ConfigV3 = z.infer<typeof ConfigV3Schema>;

/**
 * Runtime config view — v3 on disk, plus derived legacy accessors for
 * backward compat with v0.1 consumer code. Only the v3 fields are written.
 */
export interface Config extends ConfigV3 {
  /** @deprecated Use `activeProvider`. Derived from v3 state. */
  readonly provider: string;
  /** @deprecated Use `activeModel`. Derived from v3 state. */
  readonly modelPrimary: string;
  /** @deprecated Use `providers[id].baseUrl`. Derived from v3 state. */
  readonly baseUrls: Record<string, BaseUrlRef | undefined>;
}

export const ConfigSchema = ConfigV3Schema;

const LegacyConfigSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]).optional(),
  provider: ProviderIdEnum,
  modelPrimary: z.string(),
  modelFast: z.string().optional(),
  secrets: z.record(ProviderIdEnum, SecretRef).default({}),
  baseUrls: z.record(ProviderIdEnum, BaseUrlRef).default({}),
  designSystem: StoredDesignSystem.optional(),
});
type LegacyConfig = z.infer<typeof LegacyConfigSchema>;

function cloneBuiltin(id: SupportedOnboardingProvider): ProviderEntry {
  return { ...BUILTIN_PROVIDERS[id] };
}

/**
 * Pure: migrate a validated v1/v2 config to v3. Seeds the three builtin
 * providers and overlays any stored baseUrls onto them.
 */
export function migrateLegacyToV3(legacy: LegacyConfig): ConfigV3 {
  const providers: Record<string, ProviderEntry> = {};
  for (const key of SUPPORTED_ONBOARDING_PROVIDERS) {
    providers[key] = cloneBuiltin(key);
  }
  for (const [id, ref] of Object.entries(legacy.baseUrls ?? {})) {
    if (ref === undefined) continue;
    const existing = providers[id];
    if (existing !== undefined) {
      providers[id] = { ...existing, baseUrl: ref.baseUrl };
    }
  }
  const secrets: Record<string, SecretRef> = {};
  for (const [id, ref] of Object.entries(legacy.secrets ?? {})) {
    if (ref !== undefined) secrets[id] = ref;
  }
  const out: ConfigV3 = {
    version: 3,
    activeProvider: legacy.provider,
    activeModel: legacy.modelPrimary,
    secrets,
    providers,
  };
  if (legacy.designSystem !== undefined) out.designSystem = legacy.designSystem;
  return out;
}

/**
 * Single entry point for parsing raw config objects. Detects version and
 * either returns a v3 `Config` directly or runs the legacy migrator first.
 * Always returns the full `Config` runtime view with derived legacy fields.
 */
export function parseConfigFlexible(raw: unknown): Config {
  const v3 = parseV3OrMigrate(raw);
  return hydrateConfig(v3);
}

function parseV3OrMigrate(raw: unknown): ConfigV3 {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return ConfigV3Schema.parse(raw);
  }
  const r = raw as Record<string, unknown>;
  if (r['version'] === 3) {
    return ConfigV3Schema.parse(raw);
  }
  const legacy = LegacyConfigSchema.parse(raw);
  return migrateLegacyToV3(legacy);
}

/**
 * Attach derived legacy accessors to a bare v3 config. Idempotent.
 */
export function hydrateConfig(v3: ConfigV3): Config {
  const baseUrls: Record<string, BaseUrlRef | undefined> = {};
  for (const [id, entry] of Object.entries(v3.providers)) {
    if (entry !== undefined) baseUrls[id] = { baseUrl: entry.baseUrl };
  }
  return {
    ...v3,
    provider: v3.activeProvider,
    modelPrimary: v3.activeModel,
    baseUrls,
  };
}

/**
 * Strip derived fields before writing to disk. Always returns a pure v3 shape.
 */
export function toPersistedV3(cfg: Config | ConfigV3): ConfigV3 {
  return {
    version: 3,
    activeProvider: cfg.activeProvider,
    activeModel: cfg.activeModel,
    secrets: cfg.secrets,
    providers: cfg.providers,
    ...(cfg.designSystem !== undefined ? { designSystem: cfg.designSystem } : {}),
    ...(cfg.imageGeneration !== undefined ? { imageGeneration: cfg.imageGeneration } : {}),
  };
}

// ── OnboardingState ──────────────────────────────────────────────────────────

export interface OnboardingState {
  hasKey: boolean;
  provider: string | null;
  modelPrimary: string | null;
  baseUrl: string | null;
  designSystem: StoredDesignSystem | null;
}

export interface ProviderShortlist {
  provider: SupportedOnboardingProvider;
  label: string;
  keyHelpUrl: string;
  primary: string[];
  defaultPrimary: string;
}

export const PROVIDER_SHORTLIST: Record<SupportedOnboardingProvider, ProviderShortlist> = {
  anthropic: {
    provider: 'anthropic',
    label: 'Anthropic Claude',
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
    primary: ['claude-sonnet-4-6', 'claude-opus-4-1'],
    defaultPrimary: 'claude-sonnet-4-6',
  },
  openai: {
    provider: 'openai',
    label: 'OpenAI',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    primary: ['gpt-4o', 'gpt-4.1'],
    defaultPrimary: 'gpt-4o',
  },
  openrouter: {
    provider: 'openrouter',
    label: 'OpenRouter',
    keyHelpUrl: 'https://openrouter.ai/keys',
    primary: ['anthropic/claude-sonnet-4.6', 'openai/gpt-4o'],
    defaultPrimary: 'anthropic/claude-sonnet-4.6',
  },
  ollama: {
    provider: 'ollama',
    label: 'Ollama (local)',
    keyHelpUrl: 'https://ollama.com/download',
    primary: [OLLAMA_DEFAULT_MODEL, 'llama3.1', 'qwen2.5'],
    defaultPrimary: OLLAMA_DEFAULT_MODEL,
  },
};

export function isSupportedOnboardingProvider(p: string): p is SupportedOnboardingProvider {
  return (SUPPORTED_ONBOARDING_PROVIDERS as readonly string[]).includes(p);
}

/**
 * Auto-detect a sensible wire from a base URL. Used by the Custom provider
 * form to preselect the radio — user can always override.
 */
export function detectWireFromBaseUrl(baseUrl: string): WireApi {
  const lower = baseUrl.toLowerCase();
  if (lower.includes('anthropic')) return 'anthropic';
  if (lower.includes('openai.azure.com') || lower.includes('/responses')) {
    return 'openai-responses';
  }
  return 'openai-chat';
}
