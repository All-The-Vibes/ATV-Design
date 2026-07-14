---
"@atv-design/core": patch
---

Fix: cap large user messages in context pruning so long agentic runs stop failing with a bare `400 (no body)` from the provider gateway.

The `transformContext` compactor only shrank `assistant` and `toolResult` messages — `user` turns passed through uncapped. A single multi-MB user turn (a pasted brief or attached-file dump) kept the transcript far over the hard cap, so the tail-prune safety net collapsed the whole history to one message, producing a malformed continuation request the upstream rejected with `400 (no body)`. Now:

- User turns are compacted only when the transcript actually exceeds the budget (aggressive/emergency tiers), never on a normal under-budget multi-turn flow — an earlier large spec stays verbatim until real pressure hits.
- The latest user brief truncates-with-notice (keeps its head, on a code-point boundary so multibyte characters are never split) instead of being opaque-stubbed, so the model always reads the live instruction.
- `estimateBytes` measures real UTF-8 bytes instead of UTF-16 code units, so a CJK/emoji-heavy brief can no longer slip under the cap and ship ~3× over the true budget.
- The tail-prune safety net always returns a protocol-valid, non-empty continuation. It never returns an empty list, a leading/orphan `toolResult`, or a trailing bare `assistant`. When the only messages under budget are a trailing tool turn, it recovers the whole `assistant`+contiguous-`toolResults` batch (handling multi-tool turns that emit 2+ tool calls), so no malformed shape can reproduce the `400`.
