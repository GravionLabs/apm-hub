---
name: agent-write
description: >
  Creates and edits custom agent files (.agent.md). Use this skill when
  drafting or refining an agent so the result is cross-platform compatible,
  token-efficient, and convention-compliant for Copilot CLI, VS Code, and
  Claude Code.
allowed-tools: read search codebase write edit editFiles
model: claude-sonnet-4.6
chronicle-hints: 'single-purpose, structured-output, phases'
---

## Overview

Use this skill to keep agent files compact, cross-platform compatible, and convention-compliant.

**PowerShell is required:** All shell code blocks must use ` ```powershell ` syntax — never Bash or sh.

## Prerequisites

- Agent path or name
- Read `references/agent-writing-rules.md` — apply all rules throughout
- Review `assets/agent-template-optimized.md` — use as starting point for new agents

## Instructions

### Phase 1 — Plan & Validate

1. Identify the agent's **single responsibility** — if the description needs "and" more than twice, split into two agents.
2. Pick placement:
   - Copilot CLI / VS Code (project) → `.github/agents/`
   - Copilot CLI / VS Code (global) → `~/.copilot/agents/`
   - Claude Code (project) → `.claude/agents/`
   - Claude Code (global) → `~/.claude/agents/`
   - Plugin → `packages/<domain>/.apm/agents/<name>.agent.md`
3. Validate name: kebab-case, 1-64 chars, matches filename exactly, no leading/trailing/consecutive hyphens.
4. ✓ **Checkpoint:** Location and name validated. Ready for Phase 2.

### Phase 2 — Create & Structure

5. Build frontmatter using minimum cross-platform fields: `name`, `description`, `tools`, `model`.
   - If target is `claude` or `all` → check `references/agent-writing-rules.md` Platform-Specific section before adding platform-specific fields.
   - Keep `tools` minimal — grant only what the agent requires.
   - If `model` choice is unclear → load `references/model-selection.md`.
   - Set `user-invocable: false` for sub-agents called by other agents, not by users.
6. Write body using `assets/agent-template-optimized.md` as starting point:
   1. **Persona** (≤ 3 sentences) — role, expertise, communication style
   2. **Capabilities** — bullet list: what the agent may access, create, execute, or delegate
   3. **Constraints** — bullet list: what the agent must NOT do
   4. **Behavior** (optional) — specific rules as imperative bullets
7. Token-efficiency rules:
   - Prefer imperative bullets over prose paragraphs
   - Do not repeat content from `.github/copilot-instructions.md`
   - Move specs or examples longer than ~20 lines to `references/` files loaded conditionally
8. ✓ **Checkpoint:** Frontmatter and body complete. Ready for Phase 3.

### Phase 3 — Optimize & Validate

9. Ensure all shell code blocks use **only** ` ```powershell ` (never Bash or sh).
10. Final validation:
    - Filename matches `name` field exactly (e.g. `security-reviewer.agent.md`)
    - `description` answers "when should I use this agent?" in ≤ one sentence
    - `tools` list is minimal — no shell if agent only reads files
    - `model` is consistent with `references/agent-writing-rules.md` § Model guidance
    - Body follows Persona → Capabilities → Constraints (→ Behavior)
    - No content duplicated from project-level instructions
11. ✓ **Checkpoint:** Agent complete and validated. Ready for use.

## Gotchas

- Filename must match `name` exactly.
- `model` is officially supported in both GitHub Copilot and Claude Code — always valid to set.
- Claude Code ignores `user-invocable`; Copilot CLI ignores `permissionMode`. For `all` targets, use cross-platform fields only.
- Do not duplicate content from `.github/copilot-instructions.md`.
- Keep reference chains one level deep.

## Output Format

### ✅ Summary
Agent `{name}` created/updated at `{path}/{name}.agent.md`.

### 📝 What Changed
- Created/Updated: `{path}/{name}.agent.md` ({lines} lines)
- Created/Updated: `{path}/references/*.md` (if needed)

### ✔️ Verify
```powershell
$content = Get-Content "{path}/{name}.agent.md" -Raw
if ($content -match "^---") { Write-Host "✓ Has frontmatter" }
if ($content -match "name:") { Write-Host "✓ name field present" }
if ($content -match "description:") { Write-Host "✓ description present" }
if ($content -match "tools:") { Write-Host "✓ tools field present" }
```

### 🚀 Next Steps
1. Test: `copilot @{name}` (CLI) or `@{name}` in VS Code Chat
2. Audit with `agent-audit` to validate conventions
3. Commit and reference from plugin config if distributing

## See Also

- [Agent Writing Rules](references/agent-writing-rules.md)
- [Agent Frontmatter Reference](../../../packages/shared/.apm/skills/create-agent/references/agent-frontmatter.md)
- [Model Selection](references/model-selection.md)
- [Designing Agents](../../../docs/best-practices/designing-agents.md)
