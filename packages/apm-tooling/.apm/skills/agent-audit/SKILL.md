---
name: agent-audit
description: 'Audit one agent source file (<name>.agent.md) against the agent frontmatter convention and emit a findings report. Use to check or verify an agent.'
---

Audit one agent file against the agent frontmatter convention and report findings by severity.

## Prerequisites

- Agent path, usually `packages/agents/.apm/agents/<name>.agent.md`
- Read `docs/concepts/agent-frontmatter.md` at the repo root (the rules) and `references/audit-checklist.md` (the checks)

Paths to `scripts/`, `references/` and `assets/` are relative to this skill's directory.

## Instructions

1. Read the agent file; split frontmatter and body.
2. List every top-level frontmatter key; then run the checklist across top level, `metadata.claude`, `metadata.opencode` and body.
3. Record each finding as severity, category, finding, recommendation.
4. If findings exist → show them grouped 🔴 → 🟡 → 🟢 and offer to fix them via `agent-write`; otherwise report PASS.

## Gotchas

- A zero-finding report is valid; do not invent fixes.
- Top-level `model`, `mode`, `permission`, `color`, `steps` or `agents` are always 🔴 and must be fixed: move them under `metadata.claude` or `metadata.opencode`.
- Body length is enforced by `src/generators/agent-size-validator.test.ts` and model ids by `src/generators/agent-model-validator.ts`; report them, but `pnpm test` is the authority.
- Do not edit the file without the user's go. Changes to agent files belong to the agents package, not to this audit.

Report: `Audit: <name> — PASS (<n> checks)` or `FINDINGS (<n> 🔴 · <m> 🟡 · <x> 🟢)`, followed by the findings list and `Re-audit: agent-audit <agent-path>`.
