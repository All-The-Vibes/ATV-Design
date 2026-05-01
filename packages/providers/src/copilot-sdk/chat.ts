/**
 * chat.ts — Copilot chat completion entry point.
 *
 * Uses the OpenAI-compatible /chat/completions wire shape against
 * api.githubcopilot.com via CopilotClient.
 *
 * PRINCIPLES: no console.*, no client_secret anywhere.
 */

import type { CopilotClient } from './client';
import { copilotModelUnavailableError } from './errors';
import { MODEL_REGISTRY, findModel, pickDefaultModel } from './models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletion {
  id: string;
  model: string;
  content: string;
  finishReason: string | null;
  usage:
    | {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }
    | undefined;
}

// ---------------------------------------------------------------------------
// Wire-response shapes (minimal; only the fields we read)
// ---------------------------------------------------------------------------

interface WireChoice {
  message?: { content?: unknown };
  finish_reason?: unknown;
}

interface WireCompletion {
  id?: unknown;
  model?: unknown;
  choices?: WireChoice[];
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
}

// ---------------------------------------------------------------------------
// complete()
// ---------------------------------------------------------------------------

const DEFAULT_MODEL_ID = 'gpt-4.1';

/**
 * Sends a chat-completion request to Copilot and returns the parsed result.
 *
 * Model resolution order:
 *   1. `modelId` provided + in MODEL_REGISTRY → use it.
 *   2. `tier` provided → pickDefaultModel(tier, availableModels ?? []).
 *   3. Default: 'gpt-4.1'.
 *
 * If the resolved model is not in MODEL_REGISTRY, throws
 * CopilotProviderError (model-unavailable) before making any HTTP call.
 */
export async function complete(opts: {
  client: CopilotClient;
  modelId?: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  tier?: 'high' | 'medium' | 'low';
  availableModels?: ReadonlyArray<string>;
}): Promise<ChatCompletion> {
  const { client, messages, signal } = opts;

  // --- Model resolution ---
  let resolvedModelId: string;

  if (opts.modelId !== undefined) {
    const entry = findModel(opts.modelId);
    if (entry) {
      resolvedModelId = entry.id;
    } else {
      // modelId supplied but not in registry → reject immediately
      throw copilotModelUnavailableError(opts.modelId);
    }
  } else if (opts.tier !== undefined) {
    const entry = pickDefaultModel(opts.tier, opts.availableModels ?? []);
    if (entry) {
      resolvedModelId = entry.id;
    } else {
      // No registry entry for this tier in the available list → fallback default
      resolvedModelId = DEFAULT_MODEL_ID;
    }
  } else {
    resolvedModelId = DEFAULT_MODEL_ID;
  }

  // Guard: resolved model must exist in registry (catches default if registry ever drops it)
  if (!MODEL_REGISTRY.find((m) => m.id === resolvedModelId)) {
    throw copilotModelUnavailableError(resolvedModelId);
  }

  // --- HTTP call ---
  const body = JSON.stringify({
    model: resolvedModelId,
    messages,
    stream: false,
  });

  const fetchOpts: RequestInit & { signal?: AbortSignal } = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  };
  if (signal !== undefined) fetchOpts.signal = signal;

  const response = await client.fetch('/chat/completions', fetchOpts);

  const raw = (await response.json()) as WireCompletion;

  // --- Parse response ---
  const id = typeof raw.id === 'string' ? raw.id : '';
  const model = typeof raw.model === 'string' ? raw.model : resolvedModelId;
  const choice = Array.isArray(raw.choices) ? raw.choices[0] : undefined;
  const content = typeof choice?.message?.content === 'string' ? choice.message.content : '';
  const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : null;

  let usage: ChatCompletion['usage'];
  if (raw.usage) {
    const pt = typeof raw.usage.prompt_tokens === 'number' ? raw.usage.prompt_tokens : 0;
    const ct = typeof raw.usage.completion_tokens === 'number' ? raw.usage.completion_tokens : 0;
    const tt = typeof raw.usage.total_tokens === 'number' ? raw.usage.total_tokens : 0;
    usage = { promptTokens: pt, completionTokens: ct, totalTokens: tt };
  }

  return { id, model, content, finishReason, usage };
}
