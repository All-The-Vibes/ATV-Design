---
title: ATV Design vs Claude Design
description: ATV Design 与 Anthropic Claude Design 的对比——功能矩阵、取舍、分别适合谁。
head:
  - - meta
    - property: og:title
      content: ATV Design vs Claude Design — 功能对比
  - - meta
    - property: og:description
      content: ATV Design（开源、自托管、BYOK）与 Anthropic Claude Design 的诚实对比。看清楚选哪个。
---

# ATV Design vs Claude Design

两个工具都能从提示词出设计稿，但做了不同的取舍。这页让你快速判断哪一个更合你工作流。

[快速开始（90 秒）](./quickstart) · [从源码构建](./quickstart#从源码构建)

## 一句话

Claude Design 是 Anthropic 提供的托管 Web 应用，跑在 Claude Opus 上。ATV Design 是 MIT 协议桌面应用，跑在你自己电脑上，用任意你已经在用的模型 provider。

**Claude Design** 适合：想零配置、已经有 Anthropic 订阅、不需要多模型或离线的用户。

**ATV Design** 适合：需要 BYOK 成本控制、想用 Claude 之外的模型、在意本地隐私、需要本地版本历史、或需要多种导出格式的用户。

## 功能矩阵

|                         | ATV Design（开源）       | Claude Design |
| ----------------------- | :-------------------------: | :-----------: |
| 协议                    | **MIT**                     | 闭源          |
| 运行环境                | **本地（macOS / Windows / Linux）** | 云端（浏览器） |
| 支持模型                | **任意——Anthropic、OpenAI、Gemini、DeepSeek、OpenRouter、SiliconFlow、Ollama、OpenAI 兼容** | Claude Opus |
| Keyless 代理            | **支持（IP 白名单）**       | 不支持        |
| 配置导入                | **Claude Code + Codex，一键** | 不支持      |
| 内置设计 skill          | **12 个模块**（幻灯片、仪表盘、落地页、图表、定价、数据表格……） | — |
| 内置 demo               | **15 个即用模板**           | 空白画布      |
| 数据位置                | **本机 SQLite**             | Anthropic 服务器 |
| 版本历史                | **本地快照**                | —             |
| 导出                    | **HTML · PDF · PPTX · ZIP · Markdown** | HTML     |
| 行内元素评论            | **支持（AI 只改写该区域）** | —             |
| AI 可调滑块             | **支持**                    | —             |
| 响应式框架              | **手机 · 平板 · 桌面**      | 有限          |
| 价格                    | **免费（仅 token 成本）**   | 订阅制        |

## 为什么选 ATV Design

- **BYOK 意味着成本可控。** 草稿用便宜模型（DeepSeek、本地 Ollama、GPT-4o-mini），真正需要时再切 Claude Opus。
- **数据留在本机。** 提示词、设计稿、代码库扫描都不会离开你的电脑，除非你主动发给模型 provider。
- **本地版本历史。** 每一次迭代都是一个可 diff、可回滚的快照。
- **可交互的表层。** 点击元素留下评论，模型只改写那一块；拖动 AI 生成的滑块，不用重发提示就能微调颜色、间距、字体。
- **真实的导出。** PDF 走你本机 Chrome，PPTX 走 `pptxgenjs`，ZIP 打包、Markdown 带 frontmatter，全部按需懒加载。
- **导入你已有的配置。** 一键读取 Claude Code 或 Codex 的 provider / model / Key。

## 为什么选 Claude Design

- 零安装、零配置。
- 与 Anthropic 产品生态无缝衔接。
- 明确只想用 Opus，不在意多模型。

两个都是合理答案，按需选择。

## ATV Design 是 Claude Design 的 fork 吗？

不是。ATV Design 是基于 Open CoDesign 的 MIT 许可 fork；Open CoDesign 最初由 OpenCoworkAI 发布。它不含 Anthropic Claude Design 的任何代码，且与 Anthropic 无关联。

## 安装 ATV Design

- [90 秒快速开始](./quickstart)——当前 M1 路径
- [从源码构建](./quickstart#从源码构建)——Node 22 LTS + pnpm 9.15+
- [GitHub 仓库](https://github.com/All-The-Vibes/ATV-Design)

## 常见问题

- **真的免费吗？** 是。你只向自己带的 provider 支付 token 成本。
- **会上传数据到云吗？** 只会把你发送的提示词发给你自己配置的 provider，不会流向 ATV Design 维护者或任何共享后端。
- **能用 Ollama 吗？** 能。任何 OpenAI 兼容端点都行，keyless 代理也支持。
- **协议？** MIT。可 Fork、可商用、可分发。
