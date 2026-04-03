# Skills vs. Prompts

This document compares **Agent Skills** (`SKILL.md`) and **Prompt Files** (`.prompt.md`) — two different customization mechanisms in GitHub Copilot that are often confused.

---

## Overview

| | Prompt (`.prompt.md`) | Skill (`SKILL.md`) |
|---|---|---|
| **Surface** | VS Code Copilot Chat | Copilot CLI (+ Claude, other AI tools) |
| **Standard** | GitHub Copilot VS Code extension | [agentskills.io](https://agentskills.io) open standard |
| **Invocation** | Explicit: user types `/name` | Auto-selected by Copilot, or explicit `/name` |
| **Ideal length** | Can be long and verbose | **Concise** — injected into context on every match |
| **Distribution** | Manual copy or `files:` in plugin | Native `skills:` field in `plugin.json` |
| **Plugin support** | ❌ Not a native `plugin.json` field | ✅ First-class `plugin.json` field |

---

## Prompt Files (`.prompt.md`)

**Purpose:** User-triggered, task-specific instructions for a single interaction.

**When to use:**
- Rich, step-by-step workflows a user explicitly invokes
- IDE-integrated tasks (VS Code Chat slash commands)
- Prompts that benefit from `model:` overrides or `tools:` restrictions

**Frontmatter fields:**

| Field | Description |
|---|---|
| `mode` | `agent`, `edit`, or `ask` |
| `description` | Shown in IDE |
| `tools` | **Restricts** available tools in VS Code |
| `model` | Override the active model |
| `argument-hint` | Hint shown when user invokes the prompt |

**Project path:** `.github/prompts/name.prompt.md`  
**Global path:** `~/.github/prompts/name.prompt.md`

---

## Skills (`SKILL.md`)

**Purpose:** Specialized instruction sets that Copilot automatically loads when relevant.

**When to use:**
- Encapsulate domain knowledge that should be accessible without explicit invocation
- CLI workflows that run automatically when context matches
- Instructions that accompany scripts or resource files
- Cross-platform AI tool support (VS Code, Claude, JetBrains via CLI)

**Frontmatter fields:**

| Field | Required | Description |
|---|---|---|
| `name` | ✅ | Unique identifier (kebab-case) |
| `description` | ✅ | When Copilot should use this skill (drives auto-selection) |
| `allowed-tools` | — | Pre-approved tools (no confirmation dialog) |
| `license` | — | License identifier |

> ⚠️ **`allowed-tools` ≠ `tools:`** — The `allowed-tools` field pre-approves tool use without asking the user. This is a convenience/security setting, not a restriction. Tools not listed are still available — Copilot will just ask for confirmation first.

**Project path:** `.github/skills/name/SKILL.md`  
**Global path:** `~/.copilot/skills/name/SKILL.md`

---

## The Generator in This Repository

This repository uses a **generator** (`npm run generate`) that creates `SKILL.md` files from `.prompt.md` templates. This provides a pragmatic bridge: one source file serves both VS Code users (as prompts) and CLI users (as skills).

### Known Limitations

| Limitation | Impact |
|---|---|
| Long prompts become long skills | Token cost; auto-selection injects 300+ lines into context |
| `tools:` → `allowed-tools:` mapping is semantically wrong | `tools:` restricts; `allowed-tools:` pre-approves — opposite semantics |
| Not all prompts should be skills | Wizard workflows (`gh-copilot-setup`) get auto-selected too broadly |
| Skills can't include scripts | Generator only outputs the body, can't add companion scripts |

### Planned Migration

The long-term plan is to maintain **dedicated, concise `SKILL.md` files** for CLI use, separate from the verbose `.prompt.md` templates. See the [architecture discussion issue](https://github.com/GravionLabs/copilot-hub/issues) for details.

---

## Decision Guide

**Use a prompt when:**
- The task is a multi-step workflow the user consciously starts
- You want VS Code-specific features (`model:`, `tools:` restriction)
- The instructions are long or detailed
- You want the user to see exactly what will happen

**Use a skill when:**
- The instructions should be applied automatically when relevant
- You want cross-platform support (CLI, Claude, other agentskills.io tools)
- The instructions are concise (≤ 100 lines recommended)
- You want native plugin distribution

---

## Further Reading

- [Prompts](prompts.md) — full prompt file documentation
- [Skills](skills.md) — full skill documentation
- [global-sharing.md](../sync/global-sharing.md) — global path setup for both
- [About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) — GitHub Docs
- [Prompt files reference](https://docs.github.com/en/copilot/customizing-copilot/using-prompt-files-with-github-copilot) — GitHub Docs
