---
title: Quickstart
description: Install ATV Design and render your first AI-generated prototype in 90 seconds.
---

# Quickstart

Get ATV Design running on macOS, Windows, or Linux in three steps.

## 1. Install

M1 currently ships as a source build. Clone the repo, install dependencies, and run the desktop app locally:

```bash
git clone https://github.com/All-The-Vibes/ATV-Design.git
cd atv-design
pnpm install
pnpm dev
```

::: tip v0.1 note
Requires Node 22 LTS and pnpm 9.15+. If you package the app locally on macOS, the unsigned bundle path is `"/Applications/atv-design.app"` and Gatekeeper may require `xattr -cr "/Applications/atv-design.app"` before first launch.
:::

## 2. Add a provider

First launch opens the Settings page. Pick one path:

- **GitHub Copilot OAuth** — click **Sign in with GitHub**. The app opens your browser and completes the callback on `http://127.0.0.1:<random-port>/oauth-callback`.
- **Import from Claude Code or Codex** — one click, we read your existing config (`~/.codex/config.toml`, `~/.claude/settings.json`) and bring every provider, model, and key over.
- **Manual** — paste any API key. Provider is auto-detected from prefix (`sk-ant-…` → Anthropic, `sk-…` → OpenAI, etc.).
- **Keyless** — for IP-allowlisted proxies (enterprise gateways, local Ollama), leave the key blank.

Supported out of the box: GitHub Copilot OAuth, Anthropic Claude, OpenAI GPT, Google Gemini, DeepSeek, OpenRouter, SiliconFlow, local Ollama, and any OpenAI-compatible endpoint. Credentials stay in `~/.config/atv-design/config.toml`, encrypted via Electron `safeStorage`. Nothing is uploaded.

## 3. Type your first prompt

Pick one of eight built-in demos from the Hub, or type your own. The first artifact renders in seconds inside a sandboxed iframe — HTML or a live React component, depending on what the prompt calls for.

## What to try next

- **Inline comment** — click any element in the preview, leave a note. The model rewrites only that region.
- **Tunable sliders** — the model exposes the parameters worth tuning (color, spacing, font). Drag to refine without round-tripping.
- **Switch designs** — the last five designs keep their preview iframes alive for zero-delay switching.
- **Export** — HTML, PDF (via your local Chrome), PPTX, ZIP, or Markdown, all generated on-device.

## Build from source

The commands above are the canonical M1 install path. See [Architecture](./architecture) for the repo layout.

## Going further

- [Architecture](./architecture) — how the packages fit together.
- [Roadmap](./roadmap) — what ships when.
- [GitHub Issues](https://github.com/All-The-Vibes/ATV-Design/issues) — bug reports and feature requests.
