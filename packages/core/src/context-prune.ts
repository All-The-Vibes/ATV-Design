/**
 * Per-message size-based context compaction for pi-agent-core's
 * `transformContext` hook. Runs before every LLM call.
 *
 * Philosophy: **history is intent tracking, not payload storage.** The model
 * needs the decision trail — which tools, in what order, with what shape —
 * not verbatim 9 MB artifact dumps or whole-file view returns from ten turns
 * ago. Current file state is always recoverable via ranged `view()`.
 *
 * Evolution:
 *   - v1 (window): kept last N turns verbatim, stubbed older. Missed the
 *     dominant failure mode — a 9 MB `<artifact>` text dump sat inside the
 *     keep-verbatim window and shipped 3.97 M tokens.
 *   - v2 (windowless): stubbed every block over its cap regardless of
 *     position. Safe, but over-aggressive after the prompt OVERRIDE block
 *     eliminated the text-dump vector — the model's own latest str_replace
 *     new_str got summarized, so picking the next old_str required guessing.
 *   - v3 (this file): split behavior by block type.
 *        · `assistant.content[*].text` is always capped (8 KB, all turns).
 *          This is the regression guard: the one class of block that must
 *          never be allowed to balloon, because a bad prompt interaction
 *          can resurrect the `<artifact>` dump.
 *        · `assistant.content[*].toolCall.input` and
 *          `toolResult.content[*].text` are capped only outside a small
 *          recent-turn window. Inside the window they stay verbatim so the
 *          model reads its own just-written section and the latest view()
 *          output in full fidelity. Outside the window, large payloads
 *          collapse to a one-line stub.
 *   - v4 (user cap): `user.content` text is now capped for OLDER turns too,
 *     mirroring toolResult. v1–v3 never touched user messages, so a single
 *     multi-MB user turn (a pasted brief or attached-file dump in an early
 *     turn) survived every block cap, kept the aggregate far over
 *     HARD_CAP_BYTES, and forced tailPruneToHardCap to collapse the whole run
 *     to a lone tail message — which shipped a malformed continuation request
 *     (empty/partial tool-call pairing) that the upstream rejected with a bare
 *     `400 (no body)`. The user's LATEST brief stays verbatim while the run
 *     fits (first/windowed pass) because it is the current turn's live intent;
 *     under aggressive/emergency pressure it is truncated-with-notice to its
 *     first USER_RECENT_FLOOR chars (never opaque-stubbed) so the instruction
 *     survives. Earlier user turns collapse to an opaque stub. Non-text blocks
 *     (e.g. images) pass through untouched.
 *
 * Block-level caps:
 *   - TEXT_BLOCK_LIMIT     — assistant prose, ALL turns.
 *   - TOOL_INPUT_LIMIT     — assistant.toolCall.input, older turns only.
 *   - TOOL_RESULT_LIMIT    — toolResult.text AND older user.text.
 *   - USER_RECENT_FLOOR    — head kept from the LATEST user brief when
 *                            aggressive/emergency caps force it to shrink.
 *
 * Stub format carries bytes + a short preview so the model can tell what
 * got dropped, and (for tool calls) keeps tool NAME + id so pi-ai's shape
 * validation remains happy.
 *
 * Safety net: after per-block stubbing, if the grand total still exceeds
 * `HARD_CAP_BYTES`, we shrink caps further (including within the window)
 * and re-run. If that still exceeds the cap because the run has accumulated
 * too many messages, keep a compact tail instead of sending a giant history.
 * Catches pathological runs with many just-under-threshold blocks.
 */

import type { AgentMessage } from '@mariozechner/pi-agent-core';
import { type CoreLogger, NOOP_LOGGER } from './logger.js';

const TEXT_BLOCK_LIMIT = 8 * 1024;
const TOOL_INPUT_LIMIT = 24 * 1024;
const TOOL_RESULT_LIMIT = 8 * 1024;
const HARD_CAP_BYTES = 200_000;
const AGGRESSIVE_BLOCK_LIMIT = 2 * 1024;
/**
 * Head kept verbatim from the LATEST user brief at the aggressive/emergency
 * tiers. The most recent user turn is the model's live instruction, so even
 * when we shrink everything else to 160 B we keep the first ~1 KB of it (then a
 * trimmed-bytes marker). Still three orders of magnitude below the multi-MB
 * dumps this module guards against, so it never reintroduces the blow-up.
 */
const USER_RECENT_FLOOR = 1024;
const EMERGENCY_BLOCK_LIMIT = 160;

/**
 * Number of most-recent non-user messages whose tool payloads (toolCall.input
 * and toolResult.text) stay verbatim. Assistant TEXT is still capped inside
 * this window — see TEXT_BLOCK_LIMIT rationale above.
 *
 * 3 covers "current turn is reading the previous turn's str_replace + its
 * toolResult" in the typical one-section-per-turn polish cadence.
 */
const RECENT_WINDOW = 3;

function estimateBytes(messages: AgentMessage[]): number {
  let total = 0;
  for (const m of messages) {
    try {
      // Measure real UTF-8 bytes, not UTF-16 code units. `.length` undercounts
      // multibyte content (CJK/emoji) by up to 3x, which would let a heavy
      // brief slip under HARD_CAP_BYTES on the estimator while shipping far
      // over the true byte budget on the wire.
      total += Buffer.byteLength(JSON.stringify(m), 'utf8');
    } catch {
      /* circular or unserializable — ignore */
    }
  }
  return total;
}

function preview(text: string): string {
  const firstLine = text.split('\n')[0] ?? '';
  return firstLine.slice(0, 80);
}

function stubText(text: string, label: string): string {
  return `[${label} — ${text.length}B, head: "${preview(text)}"]`;
}

/**
 * Keep roughly the first `keep` characters of `text` verbatim, then append a
 * one-line marker noting how many characters were trimmed. Used for the LATEST
 * user brief under memory pressure: the model must still read the actual
 * instruction, so we truncate-with-notice instead of replacing it with an
 * opaque stub. Splits on a code-point boundary (via Array.from) so a multi-byte
 * character (emoji, CJK) is never cut mid-surrogate into a lone half.
 */
function truncateHead(text: string, keep: number): string {
  if (text.length <= keep) return text;
  const points = Array.from(text);
  if (points.length <= keep) return text;
  const head = points.slice(0, keep).join('');
  const trimmed = text.length - head.length;
  return `${head}\n[… ${trimmed} chars of this message trimmed to fit context]`;
}

function compactAssistant(
  m: AgentMessage,
  textLimit: number,
  toolLimit: number | null,
): AgentMessage {
  const original = m as unknown as {
    role: 'assistant';
    content?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(original.content)) return m;
  let changed = false;
  const nextContent = original.content.map((block) => {
    const type = block?.['type'];
    if (type === 'text') {
      const text = typeof block['text'] === 'string' ? (block['text'] as string) : '';
      if (text.length <= textLimit) return block;
      changed = true;
      return { ...block, text: stubText(text, 'prior assistant output dropped') };
    }
    if (type === 'toolCall' && toolLimit !== null) {
      const input = block['input'];
      let origBytes = 0;
      let preview = '';
      try {
        const serialized = JSON.stringify(input ?? null);
        origBytes = serialized.length;
        preview = serialized.slice(0, 80);
      } catch {
        /* ignore */
      }
      if (origBytes <= toolLimit) return block;
      changed = true;
      return {
        ...block,
        input: { _summarized: true, _origBytes: origBytes, _preview: preview },
      };
    }
    return block;
  });
  if (!changed) return m;
  return { ...(original as object), content: nextContent } as unknown as AgentMessage;
}

function compactToolResult(m: AgentMessage, limit: number | null): AgentMessage {
  if (limit === null) return m;
  const original = m as unknown as {
    role: 'toolResult';
    content?: Array<{ type: string; text?: string }>;
  };
  if (!Array.isArray(original.content)) return m;
  let changed = false;
  const nextContent = original.content.map((block) => {
    if (block?.type !== 'text') return block;
    const text = typeof block.text === 'string' ? block.text : '';
    if (text.length <= limit) return block;
    changed = true;
    return { ...block, text: stubText(text, 'tool result dropped — use view() for current state') };
  });
  if (!changed) return m;
  return { ...(original as object), content: nextContent } as unknown as AgentMessage;
}

/**
 * Cap large TEXT blocks in a user message. Two modes:
 *   - 'stub' (older turns): replace the text with an opaque one-line stub, like
 *     tool results. Early user turns are pure history — the model can re-read
 *     current file state via view(). Leaving them uncapped was the one hole
 *     that let a single multi-MB user turn survive emergency caps and force
 *     tailPruneToHardCap to collapse the whole run to a lone tail message,
 *     producing a malformed continuation request (the bare `400 (no body)`).
 *   - 'truncate' (the LATEST brief under aggressive/emergency pressure): keep
 *     the first `limit` chars verbatim + a trimmed-bytes marker, so the model
 *     still reads the actual instruction instead of an opaque placeholder.
 *
 * Non-text blocks (e.g. images) are passed through untouched in both modes.
 */
function compactUser(
  m: AgentMessage,
  limit: number | null,
  mode: 'stub' | 'truncate',
): AgentMessage {
  if (limit === null) return m;
  const shrink = (text: string): string =>
    mode === 'truncate' ? truncateHead(text, limit) : stubText(text, 'earlier message dropped');
  const original = m as unknown as {
    role: 'user';
    content?: unknown;
  };
  // User content may be a bare string (never large in practice, but guard it)
  // or an array of blocks. Only the array-of-blocks shape can balloon.
  if (typeof original.content === 'string') {
    if (original.content.length <= limit) return m;
    return {
      ...(original as object),
      content: shrink(original.content),
    } as unknown as AgentMessage;
  }
  if (!Array.isArray(original.content)) return m;
  let changed = false;
  const nextContent = original.content.map((block) => {
    const b = block as { type?: string; text?: string };
    if (b?.type !== 'text') return block;
    const text = typeof b.text === 'string' ? b.text : '';
    if (text.length <= limit) return block;
    changed = true;
    return { ...b, text: shrink(text) };
  });
  if (!changed) return m;
  return { ...(original as object), content: nextContent } as unknown as AgentMessage;
}

/**
 * Index threshold (inclusive) — messages at or after this index are "recent"
 * and their assistant/toolResult payloads stay verbatim. Counts assistant +
 * toolResult roles from the tail. User messages don't consume window slots and
 * are NOT gated by this threshold: their compaction is decided separately in
 * applyCaps by `lastUserIndex` (the latest user turn truncates-with-notice,
 * earlier user turns stub), so a non-latest user turn is compacted regardless
 * of where it sits relative to this window.
 */
function computeWindowStart(messages: AgentMessage[], windowTurns: number): number {
  if (windowTurns <= 0) return messages.length;
  let seen = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const role = messages[i]?.role;
    if (role === 'assistant' || role === 'toolResult') {
      seen += 1;
      if (seen >= windowTurns) return i;
    }
  }
  return 0;
}

interface CapConfig {
  textLimit: number;
  toolInputLimitOld: number;
  toolResultLimitOld: number;
  toolInputLimitRecent: number | null;
  toolResultLimitRecent: number | null;
  userLimitOld: number | null;
  userLimitRecent: number | null;
  windowTurns: number;
}

function lastUserIndex(messages: AgentMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return i;
  }
  return -1;
}

function applyCaps(messages: AgentMessage[], cfg: CapConfig): AgentMessage[] {
  const windowStart = computeWindowStart(messages, cfg.windowTurns);
  // The most recent user turn is the live instruction. It is always treated as
  // "recent" for capping (truncate-with-notice), independent of the
  // assistant/toolResult window — otherwise the windowless aggressive/emergency
  // tiers would opaque-stub the very brief the model is trying to satisfy.
  const latestUser = lastUserIndex(messages);
  return messages.map((m, idx) => {
    const isRecent = idx >= windowStart;
    if (m.role === 'assistant') {
      return compactAssistant(
        m,
        cfg.textLimit,
        isRecent ? cfg.toolInputLimitRecent : cfg.toolInputLimitOld,
      );
    }
    if (m.role === 'toolResult') {
      return compactToolResult(m, isRecent ? cfg.toolResultLimitRecent : cfg.toolResultLimitOld);
    }
    if (m.role === 'user') {
      // Latest brief: truncate-with-notice so its instruction survives. Older
      // user turns: opaque stub, like tool results.
      return idx === latestUser
        ? compactUser(m, cfg.userLimitRecent, 'truncate')
        : compactUser(m, cfg.userLimitOld, 'stub');
    }
    return m;
  });
}

function dropLeadingToolResults(messages: AgentMessage[]): AgentMessage[] {
  let start = 0;
  while (messages[start]?.role === 'toolResult') start += 1;
  return messages.slice(start);
}

function tailPruneToHardCap(messages: AgentMessage[], maxBytes: number): AgentMessage[] {
  if (estimateBytes(messages) <= maxBytes) return messages;

  const kept: AgentMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    const candidate = dropLeadingToolResults([message, ...kept]);
    if (estimateBytes(candidate) > maxBytes) break;
    kept.unshift(message);
  }

  const safeKept = dropLeadingToolResults(kept);
  if (safeKept.length > 0) return safeKept;

  // Everything that "fit" was leading toolResult(s) with no owning assistant
  // tool_call — shipping them alone is the malformed continuation shape a
  // provider rejects with a bare 400, and returning [] is the empty variant of
  // the same failure. A well-formed continuation must END in `user` or
  // `toolResult` (never a bare `assistant`, which still expects its results) and
  // every `toolResult` must be preceded by its owning `assistant` tool_call.
  //
  // The trailing turn is an assistant that emitted 1..N tool calls followed by
  // its N contiguous toolResults. Recover that whole batch (assistant + all its
  // toolResults) so the pairing is intact regardless of how many tools it used.
  const lastToolResultIdx = findLastIndex(messages, (m) => m?.role === 'toolResult');
  if (lastToolResultIdx > 0) {
    let assistantIdx = lastToolResultIdx;
    while (assistantIdx > 0 && messages[assistantIdx - 1]?.role === 'toolResult') {
      assistantIdx -= 1;
    }
    assistantIdx -= 1; // step onto the assistant that owns the batch
    if (assistantIdx >= 0 && messages[assistantIdx]?.role === 'assistant') {
      return messages.slice(assistantIdx, lastToolResultIdx + 1);
    }
  }
  // No recoverable assistant+toolResult batch — drop to the last real
  // (non-toolResult, non-assistant) message so the transcript ends validly;
  // else the very last message, guaranteeing non-empty.
  const lastValidTail = [...messages]
    .reverse()
    .find((m) => m?.role !== 'toolResult' && m?.role !== 'assistant');
  const fallback = lastValidTail ?? messages[messages.length - 1];
  return fallback ? [fallback] : messages;
}

function findLastIndex<T>(arr: T[], pred: (v: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (pred(arr[i] as T)) return i;
  }
  return -1;
}

export function buildTransformContext(
  log: CoreLogger = NOOP_LOGGER,
): (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]> {
  return async (messages) => {
    if (messages.length === 0) return messages;

    const before = estimateBytes(messages);
    const first = applyCaps(messages, {
      textLimit: TEXT_BLOCK_LIMIT,
      toolInputLimitOld: TOOL_INPUT_LIMIT,
      toolResultLimitOld: TOOL_RESULT_LIMIT,
      toolInputLimitRecent: null,
      toolResultLimitRecent: null,
      // User turns are the human's intent — leave them untouched while the whole
      // transcript still fits the budget. They are only compacted at the
      // aggressive/emergency tiers below, which fire ONLY when firstSize already
      // exceeds HARD_CAP_BYTES. (Capping older user turns here would silently
      // stub a 9 KB spec on a normal under-budget multi-turn flow.)
      userLimitOld: null,
      userLimitRecent: null,
      windowTurns: RECENT_WINDOW,
    });
    const firstSize = estimateBytes(first);

    log.info('[context-prune] step=caps', {
      messages: messages.length,
      before,
      after: firstSize,
      textLimit: TEXT_BLOCK_LIMIT,
      toolInputLimit: TOOL_INPUT_LIMIT,
      toolResultLimit: TOOL_RESULT_LIMIT,
      window: RECENT_WINDOW,
    });

    if (firstSize <= HARD_CAP_BYTES) return first;

    const aggressive = applyCaps(messages, {
      textLimit: AGGRESSIVE_BLOCK_LIMIT,
      toolInputLimitOld: AGGRESSIVE_BLOCK_LIMIT,
      toolResultLimitOld: AGGRESSIVE_BLOCK_LIMIT,
      toolInputLimitRecent: AGGRESSIVE_BLOCK_LIMIT,
      toolResultLimitRecent: AGGRESSIVE_BLOCK_LIMIT,
      userLimitOld: AGGRESSIVE_BLOCK_LIMIT,
      userLimitRecent: Math.max(AGGRESSIVE_BLOCK_LIMIT, USER_RECENT_FLOOR),
      windowTurns: 0,
    });
    const aggressiveSize = estimateBytes(aggressive);
    log.info('[context-prune] step=aggressive', {
      messages: messages.length,
      before,
      first: firstSize,
      after: aggressiveSize,
      blockLimit: AGGRESSIVE_BLOCK_LIMIT,
    });
    if (aggressiveSize <= HARD_CAP_BYTES) return aggressive;

    const emergency = applyCaps(messages, {
      textLimit: EMERGENCY_BLOCK_LIMIT,
      toolInputLimitOld: EMERGENCY_BLOCK_LIMIT,
      toolResultLimitOld: EMERGENCY_BLOCK_LIMIT,
      toolInputLimitRecent: EMERGENCY_BLOCK_LIMIT,
      toolResultLimitRecent: EMERGENCY_BLOCK_LIMIT,
      userLimitOld: EMERGENCY_BLOCK_LIMIT,
      userLimitRecent: Math.max(EMERGENCY_BLOCK_LIMIT, USER_RECENT_FLOOR),
      windowTurns: 0,
    });
    const emergencySize = estimateBytes(emergency);
    log.info('[context-prune] step=emergency', {
      messages: messages.length,
      before,
      aggressive: aggressiveSize,
      after: emergencySize,
      blockLimit: EMERGENCY_BLOCK_LIMIT,
    });
    if (emergencySize <= HARD_CAP_BYTES) return emergency;

    const tailPruned = tailPruneToHardCap(emergency, HARD_CAP_BYTES);
    const tailPrunedSize = estimateBytes(tailPruned);
    log.info('[context-prune] step=tail_prune', {
      messages: messages.length,
      before,
      emergency: emergencySize,
      after: tailPrunedSize,
      keptMessages: tailPruned.length,
      droppedMessages: messages.length - tailPruned.length,
    });
    return tailPruned;
  };
}
