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
small, or a **primary-agent entry point** (`claude --agent orchestrator`). Procedural workflows
stay skills.

## Top level (Copilot style, the primary format)

| Key              | Required | Rules                                                                                  |
| :--------------- | :------- | :------------------------------------------------------------------------------------- |
| `name`           | yes      | kebab-case, matches the file stem                                                      |
| `description`    | yes      | One sentence on what the agent returns and one on when a caller should use it; ≤ 200 characters |
| `tools`          | no       | Copilot aliases as a YAML list: `read`, `search`, `edit`, `execute`, `agent`           |
| `user-invocable` | no       | `false` for subagents the user never starts directly                                   |
| `disable-model-invocation` | no | `true` keeps other agents from dispatching this agent as a subagent (Copilot/VS Code); `apmw` strips it for the other platforms |
| `metadata`       | yes      | `claude:` and `opencode:` blocks, see below                                            |

A primary agent (`orchestrator`) must never be dispatched as a subagent: a subagent has no question tool, so its
approval gates cannot hold. Copilot is protected by `disable-model-invocation`, OpenCode by `mode: primary`,
Claude Code by the rule in the agent body.

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
    model: anthropic/claude-haiku-5-5  # provider/model id
    permission:                        # OpenCode permission map; bash accepts glob rules
      read: allow
      edit: deny
      bash: deny
      task: deny
```

### Allowed model ids

Copy the OpenCode id from this table, never from another agent file. The single source in code is
`src/generators/agent-model-validator.ts`; `pnpm test` fails when an agent uses an id that is not listed there.

| Tier | `metadata.claude.model` | `metadata.opencode.model` |
|:--|:--|:--|
| haiku | `haiku` | `anthropic/claude-haiku-5-5` |
| sonnet | `sonnet` | `anthropic/claude-sonnet-5-5` |
| opus | `opus` | `anthropic/claude-opus-5-5` |
| caller's model | `inherit` | (omit) |

To bump a model, edit `OPENCODE_MODEL_BY_TIER`, this table and the agent files.

## Model: frontmatter versus dispatch

`metadata.claude.model` / `metadata.opencode.model` is the default for the role. An `Agent` call
without `model` inherits the caller's model, usually the most expensive one, so the orchestrator
names the model on every dispatch (see its "Model per dispatch" rule; the `implementer` defaults to
`sonnet`, and the orchestrator passes `inherit` or stronger for integration and design tasks) and escalates one tier in
the fix loop instead of retrying the same model.

## Body rules

- ≤ 40 lines (enforced by `src/generators/agent-size-validator.test.ts`). Agents are contracts,
  not manuals: who calls it, what comes in, what goes out, and the rules that keep the output small.
- State the **return contract** explicitly (word limit, JSON shape). The caller keeps only that.
  The `implementer` writes its full report to `.agents/<issue>/task-<n>-report.md` and replies in
  ≤ 15 lines: `Status: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT`, commits, one test line,
  concerns, report path. Detail lives in the file, not in the caller's context.
- Name the client mechanisms where they differ (Claude `Agent`, OpenCode and Copilot CLI `task`,
  VS Code Copilot `runSubagent`) and the inline fallback for a session without a subagent tool.
  Do not design an agent around a subagent that starts subagents or that is resumed later: the
  [client matrix](../orchestrator.md#clients) shows that only Claude Code documents both.
- Delegate by agent name; never duplicate a skill's body in an agent.

## Enforcement

- `scripts/check-manifests.mjs` keeps `packages/agents/apm.yml` `agents:` in sync with the files.
- `agent-size-validator` fails CI on bodies over 40 lines.
- `apmw`'s fixture tests (`tests/fixtures/agents`) hold a copy of each agent; update them when an
  agent changes.
