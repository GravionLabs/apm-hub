# Agent Frontmatter Convention

Agents live in `packages/agents/.apm/agents/<name>.agent.md`. APM copies each file **verbatim**
to `.claude/agents/<name>.md`, `.github/agents/<name>.agent.md` and `.opencode/agents/<name>.md`
(globally: `~/.claude/agents`, `~/.copilot/agents`, `~/.config/opencode/agents`). The three hosts
read different frontmatter, so one source file carries a platform-neutral top level plus a
`metadata:` block that [`apmw`](https://github.com/GravionLabs/apmw) resolves per platform.

## Why agents at all

Skills are the primary artifact ([skill-frontmatter.md](skill-frontmatter.md)). An agent is only
justified when a skill cannot express it: a **model** per role (haiku for exploration), a **tool
set** the host enforces (read-only reviewer), an **output contract** that keeps a caller's context
small, or a **primary-agent entry point** (`claude --agent lead`). Procedural workflows
stay skills.

## Top level (Copilot style, the primary format)

| Key              | Required | Rules                                                                                  |
| :--------------- | :------- | :------------------------------------------------------------------------------------- |
| `name`           | yes      | kebab-case, matches the file stem                                                      |
| `description`    | yes      | One sentence on what the agent returns and one on when a caller should use it; ≤ 200 characters |
| `tools`          | no       | Copilot aliases as a YAML list: `read`, `search`, `edit`, `execute`, `agent`           |
| `user-invocable` | no       | `false` for subagents the user never starts directly                                   |
| `metadata`       | yes      | `claude:` and `opencode:` blocks, see below                                            |

Never at top level: `model`, `mode`, `permission`, `color`, `steps`, `agents`. OpenCode rejects a
list-form `tools` and a non-hex `color` at load time; Claude Code needs its own tool names.

## `metadata.claude` and `metadata.opencode`

`apmw sanitize -p <platform>` strips the fields the platform does not read, injects the lines
under `metadata.<platform>` as top-level keys, and removes `metadata` from every output.

```yaml
metadata:
  claude:
    tools: [Read, Grep, Glob]          # Claude tool names; Agent, Bash, Edit, Write, Skill, AskUserQuestion …
    model: haiku                       # haiku | sonnet | opus | inherit
    skills: [implementation]           # optional: skills preloaded into the agent
  opencode:
    mode: subagent                     # subagent | primary
    model: anthropic/claude-haiku-4-5  # provider/model id
    permission:                        # OpenCode permission map; bash accepts glob rules
      read: allow
      edit: deny
      bash: deny
      task: deny
```

## Model: frontmatter versus dispatch

`metadata.claude.model` / `metadata.opencode.model` is the default for the role. An `Agent` call
without `model` inherits the caller's model, usually the most expensive one, so the orchestrator
names the model on every dispatch (see its "Model per dispatch" rule) and escalates one tier in
the fix loop instead of retrying the same model.

## Body rules

- ≤ 40 lines (enforced by `src/generators/agent-size-validator.test.ts`). Agents are contracts,
  not manuals: who calls it, what comes in, what goes out, and the rules that keep the output small.
- State the **return contract** explicitly (word limit, JSON shape). The caller keeps only that.
  The `implementer` writes its full report to `.agents/<issue>/task-<n>-report.md` and replies in
  ≤ 15 lines: `Status: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT`, commits, one test line,
  concerns, report path. Detail lives in the file, not in the caller's context.
- Name the client mechanisms where they differ (Claude `Agent`, OpenCode `task`, Copilot
  `runSubagent`) and the inline fallback for clients without subagents.
- Delegate by agent name; never duplicate a skill's body in an agent.

## Enforcement

- `scripts/check-manifests.mjs` keeps `packages/agents/apm.yml` `agents:` in sync with the files.
- `agent-size-validator` fails CI on bodies over 40 lines.
- `apmw`'s fixture tests (`tests/fixtures/agents`) hold a copy of each agent; update them when an
  agent changes.
