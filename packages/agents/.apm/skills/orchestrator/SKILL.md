---
name: orchestrator
description: 'Run the orchestrator agent inline in this session: /orchestrator [--no-overview] [--no-review-summary] plan|implement|full|next|loop <issue>. Prefer claude --agent orchestrator for real work.'
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

Act as the `orchestrator` agent in this session.

## 1. Find the agent file

Check these paths in order, first hit wins (project before global):

1. `.claude/agents/orchestrator.md`
2. `.github/agents/orchestrator.agent.md`
3. `.opencode/agents/orchestrator.md`
4. `~/.claude/agents/orchestrator.md`
5. `~/.copilot/agents/orchestrator.agent.md`
6. `~/.config/opencode/agents/orchestrator.md`

None found: stop with "install the agents package (`apm install GravionLabs/apm-hub/packages/agents` or `core -g`)".

## 2. Follow it

Read that file and follow everything below its frontmatter as your instructions for this task (single source of truth; do not restate it from memory).

## 3. Input

`$ARGUMENTS`: optional flags (`--no-overview`, `--no-review-summary`), the mode `plan|implement|full|next|loop` and the issue number (or a description for `plan|implement|full`). If empty, ask for the mode and the issue.

## Differences from the primary agent

- Tool restrictions and model are not enforced, so hold to them: never read source files or edit code yourself; delegate to `explorer`, `implementer` and `reviewer` via the Agent tool.
- Ignore earlier conversation about unrelated work; take issue context only from `gh` and the explorer summary.
- The session context keeps growing, so the context-warning stop of `loop` matters even more. Prefer `claude --agent orchestrator` for real work, especially for `loop`.
