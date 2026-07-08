import type { AgentMessage } from '@mariozechner/pi-agent-core';
import { describe, expect, it } from 'vitest';
import { buildTransformContext } from './context-prune.js';

function userMsg(text: string): AgentMessage {
  return {
    role: 'user',
    content: [{ type: 'text', text }],
  } as unknown as AgentMessage;
}

// Production user-message shape: `ChatMessage.content` is a bare string
// (see packages/shared ChatMessage schema + chatMessageToAgentMessage), passed
// verbatim into transformContext. The block-array `userMsg` above is the other
// valid shape. Both must be capped; this helper exercises the string branch.
function userStr(text: string): AgentMessage {
  return {
    role: 'user',
    content: text,
  } as unknown as AgentMessage;
}

function assistantWithToolCall(toolCallId: string, inputArg: string): AgentMessage {
  return {
    role: 'assistant',
    content: [
      { type: 'text', text: 'ok' },
      {
        type: 'toolCall',
        id: toolCallId,
        name: 'str_replace_based_edit_tool',
        input: { inputArg },
      },
    ],
  } as unknown as AgentMessage;
}

function toolResult(toolCallId: string, body: string): AgentMessage {
  return {
    role: 'toolResult',
    toolCallId,
    content: [{ type: 'text', text: body }],
  } as unknown as AgentMessage;
}

function assistantText(text: string): AgentMessage {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
  } as unknown as AgentMessage;
}

function estimateJsonBytes(messages: AgentMessage[]): number {
  return messages.reduce((total, message) => total + JSON.stringify(message).length, 0);
}

describe('buildTransformContext — size-based block compaction with recent-turn window', () => {
  it('is a no-op when every block is under its cap', async () => {
    const transform = buildTransformContext();
    const messages: AgentMessage[] = [
      userMsg('hi'),
      assistantWithToolCall('t1', 'small'),
      toolResult('t1', 'small result'),
      assistantText('done'),
    ];
    const out = await transform(messages);
    expect(out).toEqual(messages);
  });

  it('stubs a large assistant text block even on the LATEST message', async () => {
    // Text cap applies to ALL turns. Guards against the `<artifact>` text
    // dump regression (assistant streamed 9 MB JSX as prose on the final turn).
    const transform = buildTransformContext();
    const huge = 'x'.repeat(50_000);
    const messages: AgentMessage[] = [userMsg('build it'), assistantText(huge)];
    const out = await transform(messages);
    const last = out[out.length - 1] as { content: Array<{ text?: string }> };
    const text = last.content[0]?.text ?? '';
    expect(text.startsWith('[prior assistant output dropped')).toBe(true);
    expect(text).toContain('50000B');
  });

  it('keeps a large toolCall.input verbatim inside the recent window', async () => {
    // The model's own just-written str_replace must stay full-fidelity so it
    // can pick the next old_str from memory instead of guessing.
    const transform = buildTransformContext();
    const bulk = 'a'.repeat(20_000);
    const messages: AgentMessage[] = [
      userMsg('build'),
      assistantWithToolCall('call-0', bulk),
      toolResult('call-0', 'ok'),
    ];
    const out = await transform(messages);
    const a = out[1] as {
      content: Array<{ type?: string; id?: string; input?: { inputArg?: string } }>;
    };
    const tc = a.content.find((c) => c.type === 'toolCall');
    expect(tc?.id).toBe('call-0');
    expect(tc?.input?.inputArg).toBe(bulk);
  });

  it('summarizes a large toolCall.input for older turns outside the window', async () => {
    const transform = buildTransformContext();
    const bulk = 'a'.repeat(30_000);
    const messages: AgentMessage[] = [userMsg('build')];
    messages.push(assistantWithToolCall('call-old', bulk));
    messages.push(toolResult('call-old', 'ok'));
    // Three more turns push call-old out of the 3-turn window.
    for (let i = 0; i < 3; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'small'));
      messages.push(toolResult(`t${i}`, 'ok'));
    }
    const out = await transform(messages);
    const oldAssistant = out[1] as {
      content: Array<{
        type?: string;
        id?: string;
        input?: { _summarized?: boolean; _origBytes?: number };
      }>;
    };
    const tc = oldAssistant.content.find((c) => c.type === 'toolCall');
    expect(tc?.id).toBe('call-old');
    expect(tc?.input?._summarized).toBe(true);
    expect(tc?.input?._origBytes ?? 0).toBeGreaterThan(20_000);
  });

  it('keeps a large toolResult verbatim inside the recent window', async () => {
    const transform = buildTransformContext();
    const bulk = 'y'.repeat(20_000);
    const messages: AgentMessage[] = [
      userMsg('x'),
      assistantWithToolCall('call-0', 'a'),
      toolResult('call-0', bulk),
    ];
    const out = await transform(messages);
    const tr = out[2] as { toolCallId?: string; content: Array<{ text?: string }> };
    expect(tr.toolCallId).toBe('call-0');
    expect(tr.content[0]?.text).toBe(bulk);
  });

  it('stubs large toolResult bodies for older turns outside the window', async () => {
    const transform = buildTransformContext();
    const bulk = 'y'.repeat(20_000);
    const messages: AgentMessage[] = [userMsg('x')];
    messages.push(assistantWithToolCall('call-old', 'a'));
    messages.push(toolResult('call-old', bulk));
    for (let i = 0; i < 3; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'small'));
      messages.push(toolResult(`t${i}`, 'ok'));
    }
    const out = await transform(messages);
    const tr = out[2] as { toolCallId?: string; content: Array<{ text?: string }> };
    expect(tr.toolCallId).toBe('call-old');
    expect(tr.content[0]?.text?.startsWith('[tool result dropped')).toBe(true);
  });

  it('leaves small blocks untouched regardless of position', async () => {
    const transform = buildTransformContext();
    const messages: AgentMessage[] = [userMsg('go')];
    for (let i = 0; i < 20; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'tiny'));
      messages.push(toolResult(`t${i}`, `tiny result ${i}`));
    }
    const out = await transform(messages);
    expect(out).toEqual(messages);
  });

  it('keeps a large user message verbatim inside the recent window', async () => {
    // The user's latest brief is their intent — it must never be stubbed while
    // it is still the current turn's driving instruction.
    const transform = buildTransformContext();
    const opening = userMsg('x'.repeat(50_000));
    const messages: AgentMessage[] = [opening, assistantText('ok')];
    const out = await transform(messages);
    expect(out[0]).toBe(opening);
  });

  it('stubs an EARLIER user message once a newer user turn exists and size forces caps', async () => {
    // A big pasted brief / attached-file dump in an EARLIER user turn is the one
    // class of block the old code never capped, so a single multi-MB user turn
    // survived emergency caps and forced tailPrune to nuke the whole history to
    // one message — the malformed continuation request behind the Portkey 400.
    // Only NON-latest user turns stub; the latest brief is preserved separately.
    const transform = buildTransformContext();
    const earlyBrief = 'u'.repeat(400_000); // early turn, pushes over HARD_CAP
    const messages: AgentMessage[] = [userMsg(earlyBrief)];
    for (let i = 0; i < 3; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'small'));
      messages.push(toolResult(`t${i}`, 'ok'));
    }
    // A newer user turn makes the 400 KB one "earlier history", not the brief.
    messages.push(userMsg('now tweak the header'));
    const out = await transform(messages);
    const early = out[0] as { role: string; content: Array<{ type?: string; text?: string }> };
    expect(early.role).toBe('user');
    expect(early.content[0]?.text?.startsWith('[earlier message dropped')).toBe(true);
    expect(early.content[0]?.text).toContain('400000B');
    // The latest brief is retained verbatim (small, under every cap).
    const latest = out[out.length - 1] as { content: Array<{ text?: string }> };
    expect(latest.content[0]?.text).toBe('now tweak the header');
  });

  it('keeps an earlier LARGE user spec verbatim while the transcript is under budget', async () => {
    // Adversarial regression (cross-model): a normal multi-turn flow — user
    // pastes a 9 KB spec, assistant asks a question, user says "yes" — must NOT
    // stub the 9 KB spec. It is only compacted when the whole transcript
    // exceeds HARD_CAP_BYTES, not on every turn. Capping it in the first pass
    // was silent intent corruption.
    const transform = buildTransformContext();
    const spec = `SPEC: ${'requirement '.repeat(800)}`; // ~9.6 KB, > 8 KB old-cap
    const messages: AgentMessage[] = [
      userMsg(spec),
      assistantText('One question: what color?'),
      userMsg('yes, blue'),
    ];
    const out = await transform(messages);
    // Total transcript is well under HARD_CAP, so nothing is touched.
    const early = out[0] as { content: Array<{ text?: string }> };
    expect(early.content[0]?.text).toBe(spec);
    expect(early.content[0]?.text).not.toContain('earlier message dropped');
  });

  it('counts UTF-8 bytes, so a multibyte brief cannot slip under the hard cap', async () => {
    // Adversarial regression (cross-model): estimateBytes must measure real
    // UTF-8 bytes, not UTF-16 code units. A CJK brief of ~120k code units is
    // ~360 KB on the wire — it must trip the cap and be compacted, not sail
    // through because `.length` undercounts it as ~120k "bytes".
    const transform = buildTransformContext();
    // Non-latest CJK spec (a newer brief follows) so it is eligible to stub.
    const cjk = '设计'.repeat(60_000); // 120k code units, ~360 KB UTF-8
    const messages: AgentMessage[] = [
      userMsg(cjk),
      assistantWithToolCall('t0', 'small'),
      toolResult('t0', 'ok'),
      userMsg('tweak it'),
    ];
    const out = await transform(messages);
    // The oversized CJK turn was compacted (stubbed), proving the cap fired.
    const early = out[0] as { content: Array<{ text?: string }> };
    expect(early.content[0]?.text?.startsWith('[earlier message dropped')).toBe(true);
    // And the real UTF-8 size of the output is under the hard cap.
    const utf8Bytes = out.reduce((n, m) => n + Buffer.byteLength(JSON.stringify(m), 'utf8'), 0);
    expect(utf8Bytes).toBeLessThanOrEqual(200_000);
  });

  it('never returns an empty list even when the lone latest message exceeds the cap', async () => {
    // Adversarial regression (cross-model): the fix exists to STOP the prune
    // from collapsing history to a malformed/empty request. A lone latest user
    // message carrying a non-text (image) block whose base64 alone exceeds the
    // cap cannot be shrunk — tailPrune must still return that message, never [].
    const transform = buildTransformContext();
    const hugeImage = {
      role: 'user',
      content: [{ type: 'image', mimeType: 'image/png', data: 'A'.repeat(400_000) }],
    } as unknown as AgentMessage;
    const messages: AgentMessage[] = [hugeImage];
    const out = await transform(messages);
    // Non-empty: the model gets the (over-budget) message, not a malformed [].
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0]).toBe(hugeImage);
  });

  it('keeps small user messages untouched regardless of position', async () => {
    const transform = buildTransformContext();
    const opening = userMsg('build me a landing page');
    const messages: AgentMessage[] = [opening];
    for (let i = 0; i < 6; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'small'));
      messages.push(toolResult(`t${i}`, 'ok'));
    }
    const out = await transform(messages);
    expect(out[0]).toBe(opening);
  });

  it('stubs an EARLIER string-content user brief (production message shape)', async () => {
    // `chatMessageToAgentMessage` seeds history with BARE STRING content, not a
    // block array — that is the shape a chat-resumed session actually feeds
    // transformContext on turn one. The string branch of compactUser must stub
    // an early giant brief exactly like the block-array path, and must return
    // string content (not silently wrap it in an array the LLM shape rejects).
    const transform = buildTransformContext();
    const messages: AgentMessage[] = [userStr('u'.repeat(400_000))];
    for (let i = 0; i < 3; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'small'));
      messages.push(toolResult(`t${i}`, 'ok'));
    }
    messages.push(userStr('now tweak the header'));
    const out = await transform(messages);
    const early = out[0] as { role: string; content: unknown };
    expect(early.role).toBe('user');
    expect(typeof early.content).toBe('string');
    expect((early.content as string).startsWith('[earlier message dropped')).toBe(true);
    expect(early.content as string).toContain('400000B');
    // Latest string brief stays verbatim (small, under every cap).
    const latest = out[out.length - 1] as { content: unknown };
    expect(latest.content).toBe('now tweak the header');
  });

  it('truncate-heads a lone giant string-content brief instead of tail-pruning', async () => {
    // Same Portkey-400 regression guard as the block-array case, but for the
    // production string shape: a lone multi-MB string brief must truncate to its
    // head (keeping the run's full message count), not collapse to a lone tail.
    const HARD_CAP_BYTES = 200_000;
    const transform = buildTransformContext();
    const messages: AgentMessage[] = [userStr(`BUILD: ${'z'.repeat(4_000_000)}`)];
    for (let i = 0; i < 6; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'small'));
      messages.push(toolResult(`t${i}`, `ok ${i}`));
    }
    const out = await transform(messages);
    expect(estimateJsonBytes(out)).toBeLessThanOrEqual(HARD_CAP_BYTES);
    expect(out.length).toBe(messages.length);
    const brief = out[0] as { content: unknown };
    expect(typeof brief.content).toBe('string');
    expect((brief.content as string).startsWith('BUILD: ')).toBe(true);
    expect(brief.content as string).toContain('trimmed to fit context');
  });

  it('holds the USER_RECENT_FLOOR for the latest brief at the EMERGENCY tier', async () => {
    // The floor test above only tightens as far as the aggressive tier. This one
    // drives all three tiers (caps → aggressive → emergency) with many
    // just-under-2KB blocks so the emergency cap (160 B for everything else)
    // actually fires, then asserts the latest brief still keeps its ~1 KB floor
    // rather than shrinking to a 160 B stub. Guards USER_RECENT_FLOOR at
    // emergency specifically: dropping it to EMERGENCY_BLOCK_LIMIT would pass
    // every other test.
    const transform = buildTransformContext();
    const messages: AgentMessage[] = [];
    for (let i = 0; i < 180; i += 1) {
      messages.push(assistantText('p'.repeat(1_900)));
    }
    const brief = `PLEASE BUILD: ${'spec '.repeat(400)}`; // ~2 KB latest instruction
    messages.push(userMsg(brief));
    const out = await transform(messages);
    const last = out[out.length - 1] as { role: string; content: Array<{ text?: string }> };
    expect(last.role).toBe('user');
    const text = last.content[0]?.text ?? '';
    // Emergency floor (~1 KB), not a 160 B one-liner and not the full 2 KB.
    expect(text.length).toBeGreaterThan(500);
    expect(text.length).toBeLessThan(brief.length);
    expect(text.startsWith('PLEASE BUILD:')).toBe(true);
    expect(text).toContain('trimmed to fit context');
    expect(estimateJsonBytes(out)).toBeLessThanOrEqual(200_000);
  });

  it('keeps history intact when a lone giant user brief would otherwise force a tail-prune', async () => {
    // Regression guard for the Portkey 400: one giant user message (here it is
    // also the latest brief) must not push the aggregate over HARD_CAP_BYTES
    // and trigger a tail-prune down to a single message. After the fix the brief
    // truncates to its head and the run keeps its full message count.
    const HARD_CAP_BYTES = 200_000;
    const transform = buildTransformContext();
    const messages: AgentMessage[] = [userMsg(`BUILD: ${'z'.repeat(4_000_000)}`)];
    for (let i = 0; i < 6; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'small'));
      messages.push(toolResult(`t${i}`, `ok ${i}`));
    }
    const out = await transform(messages);
    expect(estimateJsonBytes(messages)).toBeGreaterThan(HARD_CAP_BYTES);
    expect(estimateJsonBytes(out)).toBeLessThanOrEqual(HARD_CAP_BYTES);
    // The whole decision trail survives — no collapse to a lone tail message.
    expect(out.length).toBe(messages.length);
    // The brief kept its head (truncate-with-notice), not an opaque stub.
    const brief = out[0] as { content: Array<{ text?: string }> };
    expect(brief.content[0]?.text?.startsWith('BUILD: ')).toBe(true);
    expect(brief.content[0]?.text).toContain('trimmed to fit context');
  });

  it('caps text but passes image blocks through untouched in an older user turn', async () => {
    // User messages can mix an image block with a text block. Only the text is
    // a prune target; the image must survive so the model still sees it. Uses an
    // EARLIER user turn (a newer brief follows) large enough to force caps.
    const transform = buildTransformContext();
    const image = { type: 'image', mimeType: 'image/png', data: 'AAAA' };
    const userWithImage: AgentMessage = {
      role: 'user',
      content: [{ ...image }, { type: 'text', text: 'w'.repeat(400_000) }],
    } as unknown as AgentMessage;
    const messages: AgentMessage[] = [userWithImage];
    for (let i = 0; i < 3; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'small'));
      messages.push(toolResult(`t${i}`, 'ok'));
    }
    messages.push(userMsg('and now the footer')); // newer brief → image turn is history
    const out = await transform(messages);
    const first = out[0] as { content: Array<{ type?: string; text?: string }> };
    const img = first.content.find((c) => c.type === 'image');
    const txt = first.content.find((c) => c.type === 'text');
    expect(img).toEqual(image);
    expect(txt?.text?.startsWith('[earlier message dropped')).toBe(true);
  });

  it('preserves a floor of the LATEST user brief even at the emergency tier', async () => {
    // The most recent user message is the live instruction. Even when the run
    // is so large that emergency caps fire (160 B for everything else), the
    // current brief keeps at least the USER_RECENT_FLOOR (~1 KB) of text so the
    // model still knows what it was asked to do.
    const transform = buildTransformContext();
    const brief = `PLEASE BUILD: ${'spec detail '.repeat(200)}`; // ~2.6 KB, > floor
    const messages: AgentMessage[] = [];
    // Bulk history from tool payloads forces the emergency tier.
    for (let i = 0; i < 60; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'p'.repeat(12_000)));
      messages.push(toolResult(`t${i}`, 'p'.repeat(12_000)));
    }
    // Latest turn is the user's brief.
    messages.push(userMsg(brief));
    const out = await transform(messages);
    const last = out[out.length - 1] as { role: string; content: Array<{ text?: string }> };
    expect(last.role).toBe('user');
    const text = last.content[0]?.text ?? '';
    // Kept a meaningful slice (floor), not stubbed to a 160 B one-liner.
    expect(text.length).toBeGreaterThan(500);
    expect(text.startsWith('PLEASE BUILD:')).toBe(true);
    // And the aggregate is still under the hard cap.
    expect(estimateJsonBytes(out)).toBeLessThanOrEqual(200_000);
  });

  it('truncates the latest brief on a code-point boundary (no split surrogate pair)', async () => {
    // truncateHead slices the head of an oversized latest brief. A naive
    // string.slice can cut a multi-byte emoji/CJK char mid-surrogate, leaving a
    // lone UTF-16 half that serializes to an invalid character. Force the
    // emergency tier with an emoji-heavy brief and assert no lone surrogate.
    const transform = buildTransformContext();
    // '🚀' is a surrogate pair (2 UTF-16 code units). A long run guarantees the
    // ~1 KB head boundary lands in the middle of a pair with a naive slice.
    const brief = `SHIP: ${'🚀'.repeat(4000)}`;
    const messages: AgentMessage[] = [];
    for (let i = 0; i < 60; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'p'.repeat(12_000)));
      messages.push(toolResult(`t${i}`, 'p'.repeat(12_000)));
    }
    messages.push(userMsg(brief));
    const out = await transform(messages);
    const last = out[out.length - 1] as { content: Array<{ text?: string }> };
    const text = last.content[0]?.text ?? '';
    expect(text.startsWith('SHIP: ')).toBe(true);
    // No unpaired surrogate anywhere in the kept head.
    expect(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text),
    ).toBe(false);
    // Round-trips through UTF-8 without replacement chars (would appear if a
    // lone surrogate had been emitted).
    expect(Buffer.from(text, 'utf8').toString('utf8')).toBe(text);
  });

  it('returns a user message with non-string, non-array content unchanged', async () => {
    // Defensive guard: malformed user content (null / undefined / bare object)
    // must pass through untouched rather than throw or be mangled, even when
    // caps are forced.
    const transform = buildTransformContext();
    const weird = { role: 'user', content: null } as unknown as AgentMessage;
    const messages: AgentMessage[] = [weird];
    for (let i = 0; i < 6; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'p'.repeat(40_000)));
      messages.push(toolResult(`t${i}`, 'p'.repeat(40_000)));
    }
    const out = await transform(messages);
    // The malformed user message is untouched (identity), never throws.
    expect(out[0]).toBe(weird);
  });

  it('handles a history with no user message (lastUserIndex returns -1)', async () => {
    // A synthetic continuation may open with assistant/toolResult only. With no
    // user turn, nothing is selected as the "latest brief" and transform still
    // completes and caps normally.
    const transform = buildTransformContext();
    const messages: AgentMessage[] = [];
    for (let i = 0; i < 60; i += 1) {
      messages.push(assistantWithToolCall(`t${i}`, 'p'.repeat(12_000)));
      messages.push(toolResult(`t${i}`, 'p'.repeat(12_000)));
    }
    const out = await transform(messages);
    // No user role present in or out; aggregate under the hard cap.
    expect(out.every((m) => m.role !== 'user')).toBe(true);
    expect(estimateJsonBytes(out)).toBeLessThanOrEqual(200_000);
  });

  it('tightens to aggressive caps (ignoring window) when HARD_CAP_BYTES is exceeded', async () => {
    const transform = buildTransformContext();
    const messages: AgentMessage[] = [userMsg('go')];
    const midText = 'p'.repeat(6_000);
    for (let i = 0; i < 40; i += 1) {
      messages.push(assistantText(midText));
      messages.push(assistantWithToolCall(`t${i}`, 'p'.repeat(10_000)));
      messages.push(toolResult(`t${i}`, 'p'.repeat(10_000)));
    }
    const out = await transform(messages);
    let droppedTextCount = 0;
    for (const m of out) {
      if (m.role !== 'assistant') continue;
      const content = (m as { content: Array<{ type?: string; text?: string }> }).content;
      for (const c of content) {
        if (c.type === 'text' && c.text?.startsWith('[prior assistant output dropped')) {
          droppedTextCount += 1;
        }
      }
    }
    expect(droppedTextCount).toBeGreaterThanOrEqual(35);
  });

  it('enforces the aggregate hard cap when many blocks sit just under the aggressive limit', async () => {
    const transform = buildTransformContext();
    const messages: AgentMessage[] = [userMsg('go')];
    for (let i = 0; i < 180; i += 1) {
      messages.push(assistantText('p'.repeat(1_900)));
    }

    const out = await transform(messages);

    expect(estimateJsonBytes(messages)).toBeGreaterThan(300_000);
    expect(estimateJsonBytes(out)).toBeLessThanOrEqual(200_000);
  });
});
