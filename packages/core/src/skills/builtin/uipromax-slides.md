---
schemaVersion: 1
name: uipromax-slides
description: "Create strategic HTML presentations with Chart.js, design tokens, responsive layouts, copywriting formulas, and contextual slide strategies."
trigger:
  providers:
    - '*'
  scope: system
disable_model_invocation: false
user_invocable: true
---
_Ported from https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (MIT). Original path: .claude/skills/slides/SKILL.md. In source checkouts, the preserved source bundle, support data, scripts, templates, references, and font assets live under `skills/ui-ux-pro-max/`. Packaged M1 apps currently ship this flattened builtin entrypoint only, so treat repo-local file paths below as source-build helpers rather than packaged-runtime contracts._

# Slides

Strategic HTML presentation design with data visualization.

<args>$ARGUMENTS</args>

## When to Use

- Marketing presentations and pitch decks
- Data-driven slides with Chart.js
- Strategic slide design with layout patterns
- Copywriting-optimized presentation content

## Subcommands

| Subcommand | Description | Reference |
|------------|-------------|-----------|
| `create` | Create strategic presentation slides | `references/create.md` |

## References (Knowledge Base)

| Topic | File |
|-------|------|
| Layout Patterns | `references/layout-patterns.md` |
| HTML Template | `references/html-template.md` |
| Copywriting Formulas | `references/copywriting-formulas.md` |
| Slide Strategies | `references/slide-strategies.md` |

## Routing

1. Parse subcommand from `$ARGUMENTS` (first word)
2. Load corresponding `references/{subcommand}.md`
3. Execute with remaining arguments
