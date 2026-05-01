/**
 * Copilot model registry and selection helpers.
 *
 * R3 (ralplan): deterministic model selection — filter by tier and available
 * id list, sort by id lexically ASCENDING, return first. If none match,
 * return undefined.
 *
 * Numbers are best-effort from public GitHub Copilot / OpenAI documentation.
 * Each uncertain value is marked with a SOURCE comment.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CopilotTier = 'high' | 'medium' | 'low';

export interface CopilotModel {
  /** Canonical model identifier used in API calls (e.g. "gpt-4.1"). */
  id: string;
  /** Human-readable label shown in Settings UI. */
  displayName: string;
  /** Copilot capability tier mapping. */
  tier: CopilotTier;
  /** Whether the model is expected to be available (registry-level flag). */
  available: boolean;
  /** Maximum context window tokens. */
  contextWindow: number;
  /** Maximum output tokens per request. */
  maxOutputTokens: number;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Seed entries for known GitHub Copilot / OpenAI models.
 *
 * NOTE: These numbers reflect best-effort research from public docs as of
 * 2025-Q1. Actual availability and limits depend on the user's Copilot tier
 * and GitHub's rollout schedule. The Copilot provider will query
 * `api.githubcopilot.com/models` at runtime to confirm availability (Wave 2C).
 */
export const MODEL_REGISTRY: ReadonlyArray<CopilotModel> = [
  {
    id: 'gpt-4.1',
    displayName: 'GPT-4.1',
    tier: 'high',
    available: true,
    // SOURCE: OpenAI gpt-4.1 announcement (April 2025) — 1M token context
    contextWindow: 1_000_000,
    // SOURCE: OpenAI gpt-4.1 API reference — 32 768 output tokens
    maxOutputTokens: 32_768,
  },
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    tier: 'medium',
    available: true,
    // SOURCE: OpenAI gpt-4o documentation — 128K context
    contextWindow: 128_000,
    // SOURCE: OpenAI gpt-4o API reference — 16 384 output tokens
    maxOutputTokens: 16_384,
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    tier: 'low',
    available: true,
    // SOURCE: OpenAI gpt-4o-mini documentation — 128K context
    contextWindow: 128_000,
    // SOURCE: OpenAI gpt-4o-mini API reference — 16 384 output tokens
    maxOutputTokens: 16_384,
  },
] as const;

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

/**
 * Pick the default model for a given tier from the list of IDs that are
 * actually available at the user's Copilot tier (obtained at runtime from the
 * models endpoint).
 *
 * R3 rule (deterministic):
 *   1. Filter MODEL_REGISTRY to entries where `entry.tier === tier` AND
 *      `entry.id` is included in `available`.
 *   2. Sort matching entries by `id` lexically ASCENDING.
 *   3. Return the first entry, or `undefined` if none match.
 */
export function pickDefaultModel(
  tier: CopilotTier,
  available: ReadonlyArray<string>,
): CopilotModel | undefined {
  const availableSet = new Set(available);
  const candidates = MODEL_REGISTRY.filter((m) => m.tier === tier && availableSet.has(m.id));
  if (candidates.length === 0) return undefined;
  // Lexical ascending sort — deterministic tiebreaker (R3)
  const sorted = [...candidates].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted[0];
}

/**
 * Look up a model by its exact id.
 * Returns `undefined` for any id not in the registry.
 */
export function findModel(id: string): CopilotModel | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}
