---
name: agent-write
description: 'Create or edit an agent source file (<name>.agent.md) that apmw resolves for Copilot, Claude Code and OpenCode. Use when drafting an agent.'
---

Write one agent source file that follows the agent frontmatter convention and keeps its body a short contract.

## Prerequisites

- Agent name, its role (model tier, tool set, output contract) and its caller
- Read `docs/concepts/agent-frontmatter.md` at the repo root and apply it throughout
- For a new agent, start from `assets/agent-template.md`

Paths to `scripts/`, `references/` and `assets/` are relative to this skill's directory.

## Instructions

### 1. Justify

1. An agent is justified only by a model per role, a host-enforced tool set, an output contract or a primary-agent entry point. If none applies → write a skill with `skill-write` instead and stop.
2. Location: `packages/agents/.apm/agents/<name>.agent.md`. Name is kebab-case and matches the file stem.

### 2. Frontmatter

3. Top level (Copilot style): `name`, `description` (what it returns and when to use it, ≤ 200 characters), optional `tools` as Copilot aliases (`read`, `search`, `edit`, `execute`, `agent`), optional `user-invocable: false` for subagents, optional `disable-model-invocation: true` for a primary agent, and `metadata`.
4. Never at top level: `model`, `mode`, `permission`, `color`, `steps`, `agents`. Platform keys go under `metadata.claude` (`tools` with Claude names, `model`, optional `skills`) and `metadata.opencode` (`mode`, `model`, `permission`).
5. Models: copy the ids from the "Allowed model ids" table in the doc (single source `MODEL_BY_TIER` in `src/generators/agent-model-validator.ts`); both models of one tier, never `inherit`.
6. Keep `metadata.claude.tools` and `metadata.opencode.permission` consistent with the top-level `tools`: a read-only agent denies `edit` and `bash` on OpenCode and lists no `Edit`/`Write`/`Bash` on Claude.

### 3. Body

7. ≤ 40 lines (enforced by `src/generators/agent-size-validator.test.ts`): who calls it, what comes in, what goes out, the rules that keep the output small.
8. State the return contract explicitly (word or line limit, JSON shape). Delegate procedures to skills by name; never copy a skill's body.
9. Where clients differ, name the mechanism (Claude `Agent`, OpenCode and Copilot CLI `task`, VS Code `runSubagent`) and the inline fallback.

### 4. Register

10. Run `node scripts/check-manifests.mjs --fix` at the repo root: it syncs the `agents:` list of `packages/agents/apm.yml` with the `.apm/agents/*.agent.md` files (and every package's `skills:` list). Then update the `agents` row in `AGENTS.md`.
11. Copy the changed file to `apmw/tests/fixtures/agents/` and regenerate the goldens there.

## Gotchas

- OpenCode rejects a list-form `tools` and a non-hex `color` at load time; the source file reaches it only through `apmw sanitize -p opencode`.
- A primary agent must never be dispatched as a subagent: set `disable-model-invocation: true` and `metadata.opencode.mode: primary`, and say so in the body for Claude Code.
- YAML comments inside `metadata.opencode.permission` go on their own line, never after a key.

Report: summary, files created or changed, and `agent-audit <agent-path>` to verify.
