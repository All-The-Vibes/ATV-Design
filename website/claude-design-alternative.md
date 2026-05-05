---
title: ATV Design vs Claude Design
description: Comparison of ATV Design — an open-source, self-hosted, BYOK desktop AI design tool — against Anthropic Claude Design. Feature matrix, tradeoffs, and when each is the right choice.
head:
  - - meta
    - property: og:title
      content: ATV Design vs Claude Design — Feature Comparison
  - - meta
    - property: og:description
      content: Honest side-by-side of ATV Design (open-source, self-hosted, BYOK) and Anthropic Claude Design. When to pick each.
---

# ATV Design vs Claude Design

Both tools turn prompts into polished designs. They make different trade-offs. This page exists so you can decide quickly which one fits your workflow.

[Quickstart (90 s)](./quickstart) · [Build from source](./quickstart#build-from-source)

## At a glance

Claude Design is a hosted web app by Anthropic that runs Claude Opus on their infrastructure. ATV Design is an MIT-licensed desktop app you run on your own machine with whichever model provider you already use.

Pick **Claude Design** if you want zero setup, are happy on an Anthropic subscription, and don't need model flexibility or offline use.

Pick **ATV Design** if you want BYOK cost control, any model beyond Claude, on-device privacy, local version history, or multiple export formats.

## Feature matrix

|                         | ATV Design (open-source) | Claude Design |
| ----------------------- | :-------------------------: | :-----------: |
| License                 | **MIT**                     | Closed        |
| Runs on                 | **Your laptop (macOS / Windows / Linux)** | Cloud (browser) |
| Models                  | **Any — Anthropic, OpenAI, Gemini, DeepSeek, OpenRouter, SiliconFlow, Ollama, OpenAI-compatible** | Claude Opus |
| Keyless proxy support   | **Yes (IP-allowlisted)**    | No            |
| Config import           | **Claude Code + Codex, one click** | No    |
| Built-in design skills  | **12 modules** (slide decks, dashboards, landing pages, charts, pricing, data tables, …) | — |
| Demo prompts            | **15 ready-to-edit**        | Blank canvas  |
| Data location           | **SQLite on your machine**  | Anthropic servers |
| Version history         | **Local snapshots**         | —             |
| Export                  | **HTML · PDF · PPTX · ZIP · Markdown** | HTML       |
| Inline element comments | **Yes (AI rewrites only the pinned region)** | — |
| AI-tunable sliders      | **Yes**                     | —             |
| Responsive frames       | **Phone · tablet · desktop** | Limited      |
| Price                   | **Free (BYOK token cost)**  | Subscription  |

## Why someone would choose ATV Design

- **BYOK means cost control.** Ship drafts on a cheap model (DeepSeek, local Ollama, GPT-4o-mini), polish on Claude Opus only when it matters.
- **Data stays on-device.** Your prompts, designs, and any codebase scans never leave your laptop unless you send them to a model provider yourself.
- **Local version history.** Every iteration is a snapshot you can diff and roll back.
- **Interactive surface.** Click an element, leave a note, watch the model rewrite only that region. Drag AI-generated sliders to tune color, spacing, and typography without re-prompting.
- **Real exports.** PDF via your local Chrome, PPTX via `pptxgenjs`, ZIP asset bundle, Markdown with frontmatter — all lazy-loaded so the cold-start bundle stays lean.
- **Import what you already have.** One click pulls every provider / model / key out of your Claude Code or Codex config.

## Why someone would stay on Claude Design

- Zero install, nothing to configure.
- Seamless integration with Anthropic's product surface.
- You explicitly want Opus-only and don't care about multi-model.

Both are reasonable answers. Use what fits.

## Is ATV Design a fork of Claude Design?

No. ATV Design is a fork of Open CoDesign, the MIT-licensed desktop design tool originally published by OpenCoworkAI. It shares no code with Anthropic's Claude Design. The name "Claude Design" belongs to Anthropic; ATV Design is not affiliated with Anthropic.

## Install ATV Design

- [90-second Quickstart](./quickstart) — current M1 path
- [Build from source](./quickstart#build-from-source) — Node 22 LTS + pnpm 9.15+
- [GitHub repository](https://github.com/All-The-Vibes/ATV-Design)

## FAQ

- **Is it really free?** Yes. You pay only the token cost to whichever model provider you bring.
- **Does it send anything to the cloud?** Only the prompts you send to your own model provider. Nothing goes to the ATV Design maintainers or a shared backend.
- **Can I use it with Ollama?** Yes. Any OpenAI-compatible endpoint works, keyless proxies included.
- **License?** MIT. Fork it, ship it, sell it.
