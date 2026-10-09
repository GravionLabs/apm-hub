---
name: agent-create
description: >
  Creates a new custom agent (.agent.md). Use this skill when building or
  scaffolding an agent from a prompt, rough idea, or role description, even
  if the request is underspecified.
---

## Overview

Create the smallest agent that still captures the required role and behavior.

**PowerShell requirement:** All shell code blocks must use ` ```powershell ` syntax. This is enforced by agent-write.
Avoid verbose reasoning.

## Prerequisites

- Agent name (kebab-case)
- Target platform(s): `cli` | `vscode` | `claude` | `opencode` | `all`
- One sentence describing the agent's role

## Instructions

1. Pick placement per `agent-write` (Copilot/VS Code `.github/agents/`, Claude Code `.claude/agents/`, opencode `.opencode/agents/`, APM package `packages/<domain>/.apm/agents/`).
2. Validate the name: kebab-case, 1-64 chars, matches filename.
3. Use skill `agent-write` to draft and validate the agent content. `agent-write` enforces PowerShell syntax and cross-platform conventions.
4. Final validation: filename matches `name`, description is specific, tools list is minimal.

## Gotchas

- Filename must match `name` exactly.
- PowerShell is required for all shell blocks — `agent-write` enforces this.
- For cross-platform agents (`all`), use only cross-platform fields; platform-specific fields cause runtime failures.
