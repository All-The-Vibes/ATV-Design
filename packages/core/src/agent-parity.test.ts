/**
 * Workstream B Phase 1 — A/B verification.
 *
 * Runs the same prompt through `generate()` (flag off) and `generateViaAgent()`
 * (flag on) with the same mocked model response, and asserts the extracted
 * artifact is byte-identical. Usage numbers use different sources in the two
 * paths (pi-ai `completeSimple` return vs. pi-agent-core `AssistantMessage`
 * state), so the check focuses on the user-visible HTML.
 *
 * Guards the Phase 1 critical invariant documented in the design doc §4.4:
 * "When USE_AGENT_RUNTIME=0 (default), behavior is EXACTLY THE SAME as before
 * this work." If this test starts failing, the flag is no longer safely
 * toggleable and Workstream C must not assume byte-identical canvas output.
 */

import type { AgentEvent, AgentMessage, AgentOptions } from '@mariozechner/pi-agent-core';
import type { ModelRef } from '@open-codesign/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const completeMock = vi.fn();

vi.mock('@open-codesign/providers', async () => {
  const actual = await vi.importActual<typeof import('@open-codesign/providers')>(
    '@open-codesign/providers',
  );
  return {
    ...actual,
    complete: (...args: unknown[]) => completeMock(...args),
    completeWithRetry: (
      _model: unknown,
      _messages: unknown,
      _opts: unknown,
      _retryOpts: unknown,
      impl: (...args: unknown[]) => unknown,
    ) => impl(_model, _messages, _opts),
  };
});

/** Captured assistant text so the mocked Agent returns the same string that
 *  `generate()` will see through its `complete()` mock. */
let fixtureAssistantText = '';

vi.mock('@mariozechner/pi-agent-core', () => {
  class MockAgent {
    readonly state: { messages: AgentMessage[] };
    private readonly listeners: Array<(e: AgentEvent) => void> = [];
    constructor(options: AgentOptions) {
      const seed = (options.initialState?.messages ?? []) as AgentMessage[];
      this.state = { messages: [...seed] };
    }
    subscribe(listener: (e: AgentEvent) => void): () => void {
      this.listeners.push(listener);
      return () => {};
    }
    async prompt(message: unknown): Promise<void> {
      this.emit({ type: 'agent_start' });
      this.emit({ type: 'turn_start' });
      const userMsg: AgentMessage = {
        role: 'user',
        content: typeof message === 'string' ? message : '',
        timestamp: 1,
      };
      this.state.messages.push(userMsg);

      const assistantMsg: AgentMessage = {
        role: 'assistant',
        // biome-ignore lint/suspicious/noExplicitAny: pi-ai Api/Provider union literals are internal.
        api: 'anthropic-messages' as any,
        // biome-ignore lint/suspicious/noExplicitAny: same.
        provider: 'anthropic' as any,
        model: 'mock',
        content: [{ type: 'text', text: fixtureAssistantText }],
        usage: {
          input: 1,
          output: 2,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 3,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'stop',
        timestamp: 2,
      };
      this.state.messages.push(assistantMsg);
      this.emit({ type: 'turn_end', message: assistantMsg, toolResults: [] });
      this.emit({ type: 'agent_end', messages: this.state.messages });
    }
    async waitForIdle(): Promise<void> {}
    abort(): void {}
    private emit(e: AgentEvent): void {
      for (const l of this.listeners) l(e);
    }
  }
  return { Agent: MockAgent };
});

vi.mock('@mariozechner/pi-ai', () => ({
  getModel: (provider: string, modelId: string) => ({
    id: modelId,
    name: modelId,
    api: 'anthropic-messages',
    provider,
    baseUrl: 'https://api.anthropic.com',
    reasoning: true,
    input: ['text'] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 64000,
  }),
}));

import { generate, generateViaAgent } from './index.js';

const MODEL: ModelRef = { provider: 'anthropic', modelId: 'claude-sonnet-4-6' };
const SAMPLE_HTML = `<!doctype html><html lang="en"><body><h1>Hi</h1></body></html>`;
const RESPONSE = `Here is your design.

<artifact identifier="design-1" type="html" title="Hello world">
${SAMPLE_HTML}
</artifact>`;

beforeEach(() => {
  completeMock.mockReset();
  fixtureAssistantText = '';
});

describe('Workstream B Phase 1 — A/B parity', () => {
  it('produces the same artifact HTML with flag off vs flag on', async () => {
    completeMock.mockResolvedValue({
      content: RESPONSE,
      inputTokens: 12,
      outputTokens: 34,
      costUsd: 0.0001,
    });
    fixtureAssistantText = RESPONSE;

    const legacy = await generate({
      prompt: 'design a landing page',
      history: [],
      model: MODEL,
      apiKey: 'sk-test',
    });
    const agentPath = await generateViaAgent({
      prompt: 'design a landing page',
      history: [],
      model: MODEL,
      apiKey: 'sk-test',
    });

    expect(legacy.artifacts).toHaveLength(1);
    expect(agentPath.artifacts).toHaveLength(1);
    expect(agentPath.artifacts[0]?.content).toBe(legacy.artifacts[0]?.content);
    expect(agentPath.message).toBe(legacy.message);
  });

  it('both paths now ignore fenced markdown source (prose fallback removed in JSX overhaul)', async () => {
    const fenced = `Here is the revised HTML artifact.

\`\`\`html
${SAMPLE_HTML}
\`\`\``;
    completeMock.mockResolvedValue({
      content: fenced,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    });
    fixtureAssistantText = fenced;

    const legacy = await generate({
      prompt: 'design a dashboard',
      history: [],
      model: MODEL,
      apiKey: 'sk-test',
    });
    const agentPath = await generateViaAgent({
      prompt: 'design a dashboard',
      history: [],
      model: MODEL,
      apiKey: 'sk-test',
    });

    // Both paths now require the structured artifact channel — the legacy
    // ```html``` rescue was removed because it encouraged the model to
    // double-emit (tool call + prose) and spammed the chat view.
    expect(legacy.artifacts).toHaveLength(0);
    expect(agentPath.artifacts).toHaveLength(0);
  });
});
