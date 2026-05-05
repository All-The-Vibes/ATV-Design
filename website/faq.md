---
title: FAQ
titleTemplate: Frequently Asked Questions — ATV Design
description: Common questions about ATV Design — the open-source desktop AI design tool. Alternative to Claude Design, v0, Bolt.new, Lovable, and Figma AI. BYOK, local-first, MIT licensed.
head:
  - - meta
    - property: og:type
      content: article
---

# Frequently Asked Questions

Answers to the questions people most often ask about ATV Design. If your question isn't here, check the [Quickstart](/quickstart) or open a [GitHub Discussion](https://github.com/All-The-Vibes/ATV-Design/discussions).

## What is ATV Design?

ATV Design is an open-source desktop AI design tool. It turns natural-language prompts into HTML prototypes, React components, slide decks, PDFs, and marketing assets. It is the open-source alternative to Anthropic's Claude Design, Vercel's v0, StackBlitz's Bolt.new, and Lovable — but it runs entirely on your laptop with your own API key for any AI model provider.

## Is ATV Design an open-source alternative to Claude Design?

Yes. ATV Design is the MIT-licensed, open-source alternative to Anthropic Claude Design. It runs entirely on your desktop, supports any AI model via BYOK (bring your own key), and requires no cloud account or subscription. The repository is at [github.com/All-The-Vibes/ATV-Design](https://github.com/All-The-Vibes/ATV-Design).

## How does ATV Design compare to v0 by Vercel?

ATV Design generates React / JSX components and HTML prototypes from prompts — the same core capability as v0. The differences:

- **Open source vs closed source.** ATV Design is MIT-licensed. v0 is closed source.
- **Your models vs their models.** ATV Design works with Claude, GPT, Gemini, DeepSeek, Kimi, GLM, Qwen, Ollama, and any OpenAI-compatible endpoint. v0 uses Vercel-hosted OpenAI models only.
- **Local vs cloud.** ATV Design runs entirely on your desktop. v0 runs in Vercel's cloud.
- **Files you own vs previews on their platform.** ATV Design produces exportable HTML / React / PDF / PPTX / ZIP files. v0 produces previews tied to the Vercel platform.

## How does ATV Design compare to Bolt.new?

Bolt.new is a browser-based full-stack app builder running on StackBlitz's WebContainer. ATV Design is a desktop app focused on design artifacts (prototypes, slide decks, marketing assets). The differences:

- **Desktop app with persistent local storage** (ATV Design) vs **browser sandbox** (Bolt.new).
- **Any LLM via BYOK** (ATV Design) vs **Anthropic Claude only** (Bolt.new).
- **Design artifacts** (ATV Design) vs **full runnable apps** (Bolt.new).
- **Files on your disk** (ATV Design) vs **files inside the WebContainer** (Bolt.new).

## How does ATV Design compare to Lovable?

- **Open source** (ATV Design, MIT) vs **closed source** (Lovable).
- **Local-first** (ATV Design) vs **cloud-hosted** (Lovable).
- **Token cost only** (ATV Design) vs **usage-priced subscription** (Lovable).
- **Design-first prototypes** (ATV Design) vs **end-to-end product creation with Supabase** (Lovable).

## How does ATV Design compare to Figma AI / Figma Make?

They serve different surfaces. Figma AI operates inside the Figma canvas and produces design frames. ATV Design produces code-native artifacts — HTML, React / JSX, PDF, PPTX — outside any proprietary design surface. They are complementary, not direct replacements. If you need designs that hand off cleanly to engineering, ATV Design's output is already code.

## Is ATV Design free?

Yes. ATV Design is MIT licensed. The app itself is free to download, use, modify, and redistribute. You only pay the token cost to whichever model provider you bring your own API key for — there is no subscription and no per-token surcharge from us.

## Can I use my Claude Code or Codex API key with ATV Design?

Yes. ATV Design reads your existing `~/.claude/settings.json` and `~/.codex/config.toml` and imports providers, models, and API keys in one click. The app uses your API key directly against the provider's endpoint — there is no proxy layer, no server-side storage, and no OAuth token hijacking.

## Can I sign in with GitHub Copilot?

Yes. ATV Design supports the official GitHub Copilot OAuth flow. Click **Sign in with GitHub** and the app completes the local callback on `http://127.0.0.1:<random-port>/oauth-callback`.

## Can I log in with my ChatGPT Plus or Codex subscription instead of an API key?

Yes. ATV Design supports ChatGPT Plus / Codex OAuth subscription login as of v0.1.4. One click, no API key required.

## Does ATV Design send my prompts or designs to any third party?

No. Designs, prompts, and scans live on your machine. v0.1 uses SQLite for design history plus a TOML config at `~/.config/atv-design/config.toml` with file mode 0600; v0.2 migrates designs into JSONL sessions and workspace files. The only outbound network traffic is directly to the model provider you configure with your own API key. No telemetry by default.

## Which AI models does ATV Design support?

- **Anthropic Claude** (Opus, Sonnet, Haiku — all versions)
- **OpenAI GPT** (GPT-5.4, GPT-4o, GPT-4 Turbo, O1, O3, O4)
- **Google Gemini** (including third-party relays with `models/` prefix)
- **DeepSeek** (V3, R1)
- **OpenRouter** (every model on the platform)
- **SiliconFlow** (Chinese models like Qwen, Kimi, GLM)
- **Kimi** (Moonshot)
- **GLM** (Zhipu)
- **Qwen** (Alibaba)
- **Ollama** (any local model)
- **Any OpenAI-compatible endpoint** — covers internal proxies, gateway services, CLIProxyAPI, and self-hosted relays.

Keyless (IP-allowlisted) corporate proxies are also supported, as are ChatGPT Plus / Codex subscription logins.

## Which platforms are supported?

- **macOS** — Apple Silicon (M1 / M2 / M3 / M4) and Intel
- **Windows** — x64 and ARM64
- **Linux** — AppImage, `.deb` (Debian / Ubuntu), `.rpm` (Fedora / RHEL)

Heavy features like PDF export (local Chrome) and PPTX generation are lazy-loaded on first use, so the base install stays small.

## How do I install ATV Design?

For M1, build from source.

```bash
git clone https://github.com/All-The-Vibes/ATV-Design.git
cd atv-design
pnpm install
pnpm dev
```

Requires Node 22 LTS and pnpm 9.15+. When tagged installers are published, they will appear on [GitHub Releases](https://github.com/All-The-Vibes/ATV-Design/releases) with `atv-design-*` filenames.

## Does ATV Design work offline?

Yes, when used with a local model runtime like Ollama. All generation flows through the same OpenAI-compatible endpoint abstraction, so local and hosted models behave identically from the app's perspective. The app itself requires no internet connection after install; only the model call requires whatever network the chosen provider needs.

## What kind of output can ATV Design produce?

- **HTML prototypes** — sandboxed iframe, inlined CSS, no external runtime dependencies. Deploy as a single file.
- **React / JSX components** — vendored React 18 + Babel, rendered on-device. Copy-paste into your own project.
- **Slide decks** — PPTX via `pptxgenjs`, editable in PowerPoint / Keynote.
- **PDF one-pagers** — rendered via Puppeteer-core against your local Chrome install.
- **ZIP asset bundles** — HTML + CSS + JS + assets, deterministic layout. For handoff to engineering.
- **Markdown exports** — with embedded frontmatter for static-site ingestion.
- **AI-generated bitmap assets** — hero images, backgrounds, illustrations, logos, generated via gpt-image-2 or OpenRouter image models. Opt-in, off by default.

## What's coming in v0.2?

v0.2 is the Agentic Design update, expected in about one week. It turns ATV Design from a one-shot prompt-to-artifact generator into a local design agent:

- **Workspace-backed designs** — every design is a pi session with JSONL history and real files on disk
- **Permissioned local tools** — read, write, edit, bash, grep, find, and ls flow through ATV Design's permission UI
- **Design-specific tools** — `ask`, `scaffold`, `skill`, `preview`, `gen_image`, `tweaks`, `todos`, and `done`
- **Preview self-checks** — the agent can render artifacts, inspect console and asset errors, and use screenshots when the model supports vision
- **Progressive skill disclosure** — design skills, scaffolds, and brand references lazy-load when the agent needs them
- **`DESIGN.md` as design-system memory** — brand values and tokens stay in editable files, not model memory
- **v0.1 migration** — existing SQLite designs migrate into workspaces and session history

See the [roadmap](/roadmap) for the milestone plan.

## Is ATV Design secure?

The security model is:

- **Local-first.** Designs, prompts, and scans never leave your machine.
- **Config on disk, 0600 permissions.** API keys live in `~/.config/atv-design/config.toml` with the same permission posture as Claude Code / Codex / gh CLI.
- **No proxy layer.** Your API key hits the provider endpoint directly.
- **No telemetry by default.** No analytics, no auto-update tracking.
- **Signed SBOM per release.** CycloneDX supply-chain manifest attached to every GitHub Release.
- **MIT license.** Audit the source yourself.

Installers are unsigned as of v0.1.x. Apple Developer ID notarization and Windows Authenticode signing land in v0.5. Until then, the repo documents reliable manual-install instructions for each platform.

## How can I contribute to ATV Design?

- **Report bugs** — open an issue with reproduction steps.
- **Suggest features** — use [GitHub Discussions → Ideas](https://github.com/All-The-Vibes/ATV-Design/discussions/categories/ideas).
- **Send PRs** — read [CONTRIBUTING.md](https://github.com/All-The-Vibes/ATV-Design/blob/main/CONTRIBUTING.md), run `pnpm lint && pnpm typecheck && pnpm test`, and add a changeset for user-visible changes.
- **Share what you built** — post in [Show & Tell](https://github.com/All-The-Vibes/ATV-Design/discussions/categories/show-and-tell). Standout posts get featured in release notes.

## Where can I get help?

- [GitHub Discussions → Q&A](https://github.com/All-The-Vibes/ATV-Design/discussions/categories/q-a) for usage questions
- [GitHub Issues](https://github.com/All-The-Vibes/ATV-Design/issues) for reproducible bugs
- [LINUX DO](https://linux.do/) (the primary Chinese-speaking community)
- WeChat group — QR code in the [README](https://github.com/All-The-Vibes/ATV-Design#community)
