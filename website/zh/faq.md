---
title: 常见问题
titleTemplate: 常见问题 — ATV Design
description: ATV Design 常见问题——开源桌面 AI 设计工具，Claude Design、v0、Bolt.new、Lovable、Figma AI 的开源替代方案。BYOK、本地优先、MIT 开源。
head:
  - - meta
    - property: og:type
      content: article
---

# 常见问题

ATV Design 用户最常问到的问题。如果这里没有你的答案，可以查看 [快速开始](/zh/quickstart) 或在 [GitHub Discussions](https://github.com/All-The-Vibes/ATV-Design/discussions) 提问。

## ATV Design 是什么？

ATV Design 是一款开源的桌面 AI 设计工具。它把自然语言提示词转换为 HTML 原型、React 组件、幻灯片、PDF 和营销素材。它是 Anthropic Claude Design、Vercel v0、StackBlitz Bolt.new、Lovable 的开源替代方案——但完全运行在你的本机，使用你自己的任意模型提供商的 API Key。

## ATV Design 是 Claude Design 的开源替代品吗？

是的。ATV Design 是 MIT 协议下、开源的 Anthropic Claude Design 替代方案。它完全运行在桌面端，通过 BYOK（自带 API Key）支持任意 AI 模型，无需云端账号或订阅。仓库地址：[github.com/All-The-Vibes/ATV-Design](https://github.com/All-The-Vibes/ATV-Design)。

## ATV Design 和 Vercel v0 比怎么样？

ATV Design 能从提示词生成 React / JSX 组件和 HTML 原型——核心能力和 v0 一样。区别在于：

- **开源 vs 闭源。** ATV Design 是 MIT 协议，v0 闭源。
- **你的模型 vs 他们的模型。** ATV Design 支持 Claude、GPT、Gemini、DeepSeek、Kimi、GLM、Qwen、Ollama，以及任意 OpenAI 兼容的接口。v0 只能用 Vercel 托管的 OpenAI 模型。
- **本地 vs 云端。** ATV Design 完全跑在桌面端，v0 跑在 Vercel 云上。
- **你拥有的文件 vs 他们平台上的预览。** ATV Design 产出可导出的 HTML / React / PDF / PPTX / ZIP 文件，v0 产出绑定 Vercel 平台的预览。

## ATV Design 和 Bolt.new 比怎么样？

Bolt.new 是基于浏览器的全栈应用构建器，跑在 StackBlitz 的 WebContainer 里。ATV Design 是聚焦设计产物（原型、幻灯片、营销素材）的桌面应用。区别在于：

- **桌面应用 + 持久化本地存储**（ATV Design）vs **浏览器沙盒**（Bolt.new）
- **任意 LLM via BYOK**（ATV Design）vs **仅 Anthropic Claude**（Bolt.new）
- **设计产物**（ATV Design）vs **完整可运行应用**（Bolt.new）
- **磁盘上的文件**（ATV Design）vs **WebContainer 内的文件**（Bolt.new）

## ATV Design 和 Lovable 比怎么样？

- **开源**（ATV Design，MIT）vs **闭源**（Lovable）
- **本地优先**（ATV Design）vs **云端托管**（Lovable）
- **只付 token 成本**（ATV Design）vs **按用量计费的订阅**（Lovable）
- **设计优先的原型**（ATV Design）vs **端到端产品打造，集成 Supabase**（Lovable）

## ATV Design 和 Figma AI / Figma Make 比怎么样？

它们解决的是不同层面的问题。Figma AI 在 Figma 画布内工作，产出设计稿。ATV Design 产出代码原生的产物——HTML、React / JSX、PDF、PPTX——不依赖任何专有设计平台。两者互补，不是直接替代关系。如果你需要能干净交付给工程团队的设计，ATV Design 的产出本身就是代码。

## ATV Design 收费吗？

不收费。ATV Design 是 MIT 协议的开源软件，应用本身可免费下载、使用、修改、分发。你只需要为你自带 API Key 的模型提供商付 token 费用——我们不收订阅费，也不在 token 上加价。

## 我能用我的 Claude Code 或 Codex API Key 吗？

可以。ATV Design 会读取你已有的 `~/.claude/settings.json` 和 `~/.codex/config.toml`，一键导入提供商、模型和 API Key。应用直接用你的 API Key 调用提供商的接口——没有代理层、没有服务端存储、不会劫持 OAuth token。

## 可以直接登录 GitHub Copilot 吗？

可以。ATV Design 支持官方 GitHub Copilot OAuth 流程。点击 **Sign in with GitHub** 后，应用会通过 `http://127.0.0.1:<random-port>/oauth-callback` 完成本地回调。

## 我能用 ChatGPT Plus 或 Codex 订阅登录代替 API Key 吗？

可以。从 v0.1.4 开始，ATV Design 支持 ChatGPT Plus / Codex OAuth 订阅登录。一键完成，无需 API Key。

## ATV Design 会把我的提示词或设计发给第三方吗？

不会。设计、提示词和扫描结果都存在你本机。v0.1 用 SQLite 存设计历史，TOML 配置文件在 `~/.config/atv-design/config.toml`，文件权限 0600；v0.2 会把设计迁到 JSONL session 和工作区文件。唯一的对外网络流量就是直接发给你配置的模型提供商，用的是你自己的 API Key。默认零遥测。

## ATV Design 支持哪些 AI 模型？

- **Anthropic Claude**（Opus、Sonnet、Haiku，全版本）
- **OpenAI GPT**（GPT-5.4、GPT-4o、GPT-4 Turbo、O1、O3、O4）
- **Google Gemini**（包括带 `models/` 前缀的第三方中转）
- **DeepSeek**（V3、R1）
- **OpenRouter**（平台上所有模型）
- **SiliconFlow**（Qwen、Kimi、GLM 等中文模型）
- **Kimi**（Moonshot）
- **GLM**（智谱）
- **Qwen**（阿里）
- **Ollama**（任意本地模型）
- **任意 OpenAI 兼容接口**——覆盖企业内部代理、网关服务、CLIProxyAPI、自托管中转。

也支持无 Key 的（IP 白名单）企业代理，以及 ChatGPT Plus / Codex 订阅登录。

## 支持哪些操作系统？

- **macOS**——Apple Silicon（M1 / M2 / M3 / M4）和 Intel
- **Windows**——x64 和 ARM64
- **Linux**——AppImage、`.deb`（Debian / Ubuntu）、`.rpm`（Fedora / RHEL）

PDF 导出（依赖本机 Chrome）、PPTX 生成等重型功能首次使用时按需加载，基础安装包保持精简。

## 怎么安装？

当前 M1 的标准安装方式是从源码运行。

```bash
git clone https://github.com/All-The-Vibes/ATV-Design.git
cd atv-design
pnpm install
pnpm dev
```

需要 Node 22 LTS 和 pnpm 9.15+。后续如果发布预构建安装包，会在 [GitHub Releases](https://github.com/All-The-Vibes/ATV-Design/releases) 里以 `atv-design-*` 文件名提供。

## ATV Design 能离线使用吗？

能，配合 Ollama 等本地模型运行时。所有生成都走同一套 OpenAI 兼容接口抽象，所以本地模型和云端模型在应用看来表现一致。应用本身安装后不需要联网；只有调用模型时需要对应提供商所需的网络。

## 能产出什么样的输出？

- **HTML 原型**——沙盒 iframe，CSS 内联，无外部运行时依赖。可作为单文件部署。
- **React / JSX 组件**——内置 React 18 + Babel，本地渲染。可复制粘贴到你的项目里。
- **幻灯片**——通过 `pptxgenjs` 生成 PPTX，PowerPoint / Keynote 可编辑。
- **PDF 单页**——通过 Puppeteer-core 调用本机 Chrome 渲染。
- **ZIP 资源包**——HTML + CSS + JS + 资源文件，目录结构确定。可交付给工程团队。
- **Markdown 导出**——带 frontmatter，可被静态站点直接收录。
- **AI 生成的位图素材**——封面图、背景图、插图、Logo，通过 gpt-image-2 或 OpenRouter 图像模型生成。可选启用，默认关闭。

## v0.2 会带来什么？

v0.2 是 Agentic Design 大更新，预计一周左右发布。它会把 ATV Design 从一次性的提示词转产物生成器，升级成一个本地设计 agent：

- **带真实工作区的 design**——每个 design 都是一个 pi session，历史写入 JSONL，产物落在磁盘文件里
- **带权限的本地工具**——read、write、edit、bash、grep、find、ls 都会经过 ATV Design 的权限 UI
- **设计专用工具**——`ask`、`scaffold`、`skill`、`preview`、`gen_image`、`tweaks`、`todos`、`done`
- **预览自检**——agent 可以渲染产物，检查 console / asset 错误；模型支持视觉时还能看截图
- **渐进式技能加载**——skill、scaffold、brand reference 按需加载，而不是全部塞进基础提示词
- **`DESIGN.md` 作为设计系统记忆**——品牌值和 token 写进可编辑文件，而不是靠模型记忆
- **v0.1 迁移路径**——旧 SQLite 设计会迁移到真实工作区和 session history

里程碑计划见 [roadmap](/roadmap)。

## ATV Design 安全吗？

安全模型：

- **本地优先。** 设计、提示词、扫描结果不出本机。
- **配置存在磁盘上，权限 0600。** API Key 存在 `~/.config/atv-design/config.toml`，权限和 Claude Code / Codex / gh CLI 一致。
- **没有代理层。** 你的 API Key 直接打到提供商接口。
- **默认零遥测。** 没有分析统计，没有自动更新追踪。
- **每个版本带签名 SBOM。** CycloneDX 供应链清单附在每个 GitHub Release 上。
- **MIT 协议。** 源码自己可审计。

v0.1.x 阶段安装包未签名。Apple Developer ID 公证和 Windows Authenticode 签名将在 v0.5 落地。在那之前，仓库里有每个平台可靠的手动安装说明。

## 怎么贡献？

- **报 bug**——开 issue 并附复现步骤。
- **提建议**——用 [GitHub Discussions → Ideas](https://github.com/All-The-Vibes/ATV-Design/discussions/categories/ideas)。
- **提 PR**——读 [CONTRIBUTING.md](https://github.com/All-The-Vibes/ATV-Design/blob/main/CONTRIBUTING.md)，跑 `pnpm lint && pnpm typecheck && pnpm test`，用户可见改动加 changeset。
- **晒成果**——发到 [Show & Tell](https://github.com/All-The-Vibes/ATV-Design/discussions/categories/show-and-tell)。优秀作品会被收录到 release notes。

## 在哪里求助？

- [GitHub Discussions → Q&A](https://github.com/All-The-Vibes/ATV-Design/discussions/categories/q-a) ——使用问题
- [GitHub Issues](https://github.com/All-The-Vibes/ATV-Design/issues) ——可复现的 bug
- [LINUX DO](https://linux.do/) ——主要的中文社区
- 微信群 ——二维码见 [README](https://github.com/All-The-Vibes/ATV-Design/blob/main/README.zh-CN.md#community)
