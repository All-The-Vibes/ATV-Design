---
'@open-codesign/desktop': patch
---

fix: keep chatgpt-codex meta replies as plain text

- `chatgpt-codex` no longer turns non-design or meta prompts like "你是什么模型" into an immediate `design.html` artifact.
- The Codex generate path now separates artifact HTML from surrounding assistant text, matching the main generate pipeline more closely.
- The renderer only marks a run as `artifact_delivered` when an actual artifact exists, so plain-text replies no longer appear as generated files.
