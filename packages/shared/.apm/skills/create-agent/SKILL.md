---
name: create-agent
description: >
  Creates a custom agent file (.agent.md) compatible with Copilot CLI, VS Code,
  and Claude Code. Use this skill when you need to scaffold a new agent with
  correct frontmatter, minimal tool access, and an appropriate model.
allowed-tools: read search codebase write edit editFiles
model: claude-sonnet-4.6
---

## Overview

Scaffold a single `.agent.md` file for Copilot CLI, VS Code, and/or Claude Code.

The result is a focused agent with correct frontmatter, a clear persona, explicit capabilities, explicit constraints, and an appropriate model.

> 💡 **Model hint:** Agent authoring requires cross-platform knowledge and multi-step reasoning — `claude-sonnet-4.6` or `gpt-5.4` recommended.

## Prerequisites

- Agent name (kebab-case)
- Target platform(s): `cli` | `vscode` | `claude` | `all`
- One sentence describing the agent's role

## Instructions

### Phase 1 — Requirements

1. Identify the agent's **single responsibility** — if the description needs "and" more than twice, split into two agents.
2. Determine **target platform(s)** and placement:
   - `cli` / `vscode` → `.github/agents/` (project) or `~/.copilot/agents/` (global)
   - `claude` → `.claude/agents/` (project) or `~/.claude/agents/` (global)
   - `all` → use cross-platform fields only; load `references/agent-frontmatter.md` for field compatibility
3. List the **minimum tools** the agent needs — grant only what it requires:
   - Read/review only → `read search codebase`
   - File creation → add `write edit editFiles`
   - Shell execution → add `execute shell runCommands`
   - Delegation to another agent → add `agent` (CLI) or `runSubagent` (VS Code)
4. Assess task complexity for model selection — load `references/model-selection.md` if unclear.
5. ✓ **Checkpoint:** Platform, tools, and model confirmed.

### Phase 2 — Draft

6. Build frontmatter — minimum cross-platform: `name`, `description`, `tools`, `model`.
   - For platform-specific fields (e.g., Claude `permissionMode`, CLI `user-invocable`), load `references/agent-frontmatter.md`.
   - Set `user-invocable: false` for agents called by other agents, not by users directly.
7. Write body using the template in `assets/agent-template.md`:
   1. **Persona** (≤ 3 sentences) — who the agent is, expertise, communication style
   2. **Capabilities** — bullet list: what files/tools/scope the agent may access
   3. **Constraints** — bullet list: what the agent must NOT do
   4. **Behavior** (optional) — specific rules beyond the persona
8. Token-efficiency rules:
   - Do not restate rules already in `.github/copilot-instructions.md` — reference the domain
   - Prefer imperative bullets over prose paragraphs
   - Move large specs or examples to `references/` files
9. ✓ **Checkpoint:** Draft complete — frontmatter and body written.

### Phase 3 — Validate & Place

10. Validate:
    - File name is kebab-case and matches `name` field exactly (e.g. `security-reviewer.agent.md`)
    - `description` answers "when should I use this agent?" in ≤ one sentence
    - Tools list is minimal — no shell pre-approval if the agent only reads files
    - `model` is present and consistent with `references/model-selection.md`
11. Write the file to the correct path for the chosen scope (see Phase 1, step 2).
12. ✓ **Checkpoint:** Agent validated and placed.

## Gotchas

- `model` is officially supported in Claude Code agents; not documented for Copilot CLI/VS Code — advisory there.
- Claude Code does not support `user-invocable`; Copilot CLI ignores `permissionMode` — use cross-platform fields for `all` targets.
- Directory/file name must match `name` field exactly.
- Do not duplicate content from `.github/copilot-instructions.md`.

## Output Format

### ✅ Summary
Agent `{name}` created at `{path}/{name}.agent.md`.

### 📝 What Changed
- Created: `{path}/{name}.agent.md` ({lines} lines)

### ✔️ Verify
```powershell
$content = Get-Content "{path}/{name}.agent.md" -Raw
if ($content -match "^---") { Write-Host "✓ Has frontmatter" }
if ($content -match "name:") { Write-Host "✓ name field present" }
if ($content -match "description:") { Write-Host "✓ description field present" }
if ($content -match "tools:") { Write-Host "✓ tools field present" }
```

### 🚀 Next Steps
1. Test: `copilot @{name}` (CLI) or `@{name}` in VS Code Chat
2. Audit with `skill-audit` if distributing via plugin
3. Reference from relevant agents: add to `## Available Skills` section

## See Also

- [Agent Frontmatter Reference](references/agent-frontmatter.md)
- [Model Selection](references/model-selection.md)
- [Agent Template](assets/agent-template.md)
- [Designing Agents](../../../../docs/best-practices/designing-agents.md)
- [Agent Writing Rules](../../../../.github/skills/agent-write/references/agent-writing-rules.md) — full conventions reference
