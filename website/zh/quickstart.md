---
title: 快速开始
description: 90 秒在 macOS / Windows / Linux 上跑通 ATV Design，渲染第一个 AI 生成原型。
---

# 快速开始

三步让 ATV Design 在你的电脑上跑起来。

## 1. 安装

M1 目前以源码运行形态交付。先 clone 仓库，安装依赖，再本地启动桌面应用：

```bash
git clone https://github.com/All-The-Vibes/ATV-Design.git
cd atv-design
pnpm install
pnpm dev
```

::: tip v0.1 说明
需要 Node 22 LTS 与 pnpm 9.15+。如果你在 macOS 上本地打包，未签名的 app bundle 路径是 `"/Applications/atv-design.app"`，首次启动前可能需要执行 `xattr -cr "/Applications/atv-design.app"`。
:::

## 2. 添加 provider

首次启动会打开设置页面，三种入口二选一：

- **GitHub Copilot OAuth** — 点击 **Sign in with GitHub**。浏览器会打开授权页，回调地址是 `http://127.0.0.1:<random-port>/oauth-callback`。
- **从 Claude Code 或 Codex 导入** — 一键导入，我们直接读 `~/.codex/config.toml` 和 `~/.claude/settings.json`，把 provider、model、API Key 一次带过来。
- **手动添加** — 粘贴任意 API Key，provider 根据前缀自动识别（`sk-ant-…` → Anthropic，`sk-…` → OpenAI，等等）。
- **Keyless** — IP 白名单代理（企业网关、本地 Ollama），Key 留空即可。

开箱支持：GitHub Copilot OAuth、Anthropic Claude、OpenAI GPT、Google Gemini、DeepSeek、OpenRouter、SiliconFlow、本地 Ollama，以及任何 OpenAI 兼容端点。凭证通过 Electron `safeStorage` 加密存储于 `~/.config/atv-design/config.toml`，不会上传。

## 3. 输入第一条提示

从 Hub 选一个内置 demo，或者自由描述。第一版几秒内就会出现在沙箱 iframe 里——HTML 或实时 React 组件，取决于提示内容。

## 接下来试试

- **行内评论** — 在预览中点击任意元素，留下评论。模型只重写该区域。
- **可调滑块** — 模型主动给出值得调的参数（颜色、间距、字体），拖动即可微调，无需重发提示。
- **切换设计** — 最近 5 个设计的预览 iframe 常驻内存，切换零延迟。
- **导出** — HTML、PDF（本机 Chrome）、PPTX、ZIP、Markdown，全部本地生成。

## 从源码构建

上面的命令就是当前 M1 的标准安装路径。仓库结构参见[架构](../architecture)。

## 继续阅读

- [架构](../architecture) — 包如何组合。
- [路线图](../roadmap) — 按版本规划。
- [GitHub Issues](https://github.com/All-The-Vibes/ATV-Design/issues) — 报 bug 或提需求。
