---
name: sync-opencode
description: >
  Strips Copilot-only `tools: [...]` arrays from `.opencode/agents/*.md`
  frontmatter so OpenCode can load them without crashing. Run after
  `apm install -t opencode`.
---

Sanitize agent files for OpenCode. OpenCode rejects `tools:` when it's a YAML
array (`tools: ['read', 'edit']`) — it requires a `permission:` object instead.

Source `.agent.md` files in `packages/` are NOT modified by default so Copilot
deployments keep their `tools: [...]` field. Run with `-Source` to also add
`permission:` to source files (preserving `tools` for Copilot).

## When to use

Run after `apm install -t opencode` whenever `.opencode/agents/*.md` files
contain `tools: [...]` in frontmatter.

## Execution

**Recommended — run the script:**
```powershell
# Default: only fix .opencode/agents/ files (OpenCode deployment copies)
pwsh scripts/Sync-OpencodeAgents.ps1

# Also add permission: to source .agent.md files (keeps tools for Copilot)
pwsh scripts/Sync-OpencodeAgents.ps1 -Source
```

**What the script does:**

| Mode | Files affected | Change |
|------|---------------|--------|
| Default | `.opencode/agents/*.md` | Strips `tools: [...]`, `user-invocable`, `agents` |
| `-Source` | `packages/*/.apm/agents/*.agent.md` | Adds `permission: {...}` from `tools: [...]`; keeps `tools` |
| Neither | `.github/agents/*.agent.md` | Unchanged — Copilot files are left alone |

## Verification

```powershell
# Check for remaining array-format tools in OpenCode agents
Select-String -Path ".opencode/agents/*.md" -Pattern '^tools:\s*\[' | Select-Object Filename
```

If no output, all files are clean.

## Constraints

- Idempotent — safe to run multiple times
- Does NOT modify `.github/agents/*.agent.md` (Copilot-only, array format is correct there)
- `-Source` mode preserves `tools: [...]` so Copilot still works
