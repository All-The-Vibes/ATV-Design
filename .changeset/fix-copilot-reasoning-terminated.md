---
"@atv-design/core": patch
---

Fix: GitHub Copilot generations no longer hang for ~10 minutes and fail with a bare `CodesignError: terminated`.

Copilot's gateway buffers a reasoning model's entire thinking phase and streams nothing back until the model finishes. For a reasoning-capable model such as `claude-sonnet-4.6`, `inferReasoning` returns true but `reasoningForModel` had no Copilot case, so the agent sent `thinkingLevel: 'off'`. With no `reasoning_effort` on the wire, Copilot applies its own extended-reasoning default, produces zero streamed tokens on a real design task, and the gateway eventually kills the idle socket — surfacing as `terminated`.

Verified against `api.githubcopilot.com`: only `reasoning_effort: 'low'` streams promptly (first token ~1.5s); `off`/`medium`/`high` all stall past 3 minutes. The agent and `runModel` paths now pin reasoning-capable Copilot models to `'low'` (overriding the inferred default and any explicit Settings value, since no other level is usable on this transport) via a new `reasoningOverrideForProvider` helper.
