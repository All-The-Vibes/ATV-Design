---
"@open-codesign/providers": minor
"@open-codesign/desktop": minor
---

feat: ChatGPT 订阅登录（Codex OAuth）

支持用 ChatGPT Plus/Pro/Team 订阅直接调用 Codex 模型（`gpt-5.3-codex`、`gpt-5.4` 等），无需 API key。

- PKCE OAuth 流程，本地 1455 端口 callback（冲突回退随机端口）
- Token 存 `~/.config/open-codesign/codex-auth.json` (0600)，5 分钟过期前主动刷新，并发去重
- 独立 token store，不与 Codex CLI 冲突
- 生成请求走 `chatgpt.com/backend-api/codex/responses`，401 自动刷新重试
- Settings 里加 "用 ChatGPT 订阅登录" 卡片

Phase 2 待做：流式响应、usage/cost 记账、图片附件、完整 craft-directives system prompt。
