## Agent Frontmatter Schema

Use this file when an agent needs the shared frontmatter rules.

> **Official vs repo-local fields:** GitHub Copilot CLI currently documents
> `name`, `description`, `tools`, `user-invocable`, and `infer`. Claude Code
> documents a broader set. This schema records the cross-platform minimum plus
> repo-local conventions used in this repository.

### Required cross-platform fields

| Field         | Rules                                                                                                                      |
|:--------------|:---------------------------------------------------------------------------------------------------------------------------|
| `name`        | Kebab-case only, 1-64 chars, must match the filename exactly, no leading/trailing/consecutive hyphens.                     |
| `description` | One sentence, imperative phrasing, shown in @-picker, answers "when should I use this agent?", includes trigger keywords. |

### Optional cross-platform fields

| Field   | Rules                                                                                                                                                    |
|:--------|:---------------------------------------------------------------------------------------------------------------------------------------------------------|
| `tools` | List of tool aliases. Minimal — grant only what the agent requires. Omit for full access; use `[]` to disable all tools.                                 |
| `model` | Repo-local advisory field only. If used, pick a value from `docs/model-overview.md`, consistent with any body-level "Model hint". Not officially required.|

### Platform-specific fields

| Field              | Platform     | Description                                                            |
|:-------------------|:-------------|:-----------------------------------------------------------------------|
| `user-invocable`   | Copilot CLI  | `false` for sub-agents called by other agents, not by users            |
| `infer`            | Copilot CLI  | `false` to disable automatic inference/delegation                      |
| `target`           | VS Code      | `vscode` \| `jetbrains` \| `all`                                      |
| `argument-hint`    | VS Code      | Placeholder text shown in the chat input box                           |
| `permissionMode`   | Claude Code  | `default` \| `acceptEdits` \| `bypassPermissions` \| `plan`           |
| `maxTurns`         | Claude Code  | Maximum agentic turns before stopping                                  |
| `isolation`        | Claude Code  | `shared` (default) or `isolated` (fresh context per invocation)       |
| `disallowedTools`  | Claude Code  | Tools the agent may NOT use (overrides `tools`)                        |
| `color`            | Claude Code  | Terminal color: `red` \| `green` \| `blue` \| `yellow` \| `magenta` \| `cyan` \| `white` |

> ⚠️ Do not use platform-specific fields for `all`-platform agents. They will
> cause runtime errors on incompatible runtimes.

### `tools` aliases

| Capability           | Aliases                                   |
|:---------------------|:------------------------------------------|
| Read files           | `read`                                    |
| Search files/text    | `search`                                  |
| Semantic search      | `codebase`                                |
| Create/edit files    | `write`, `edit`, `editFiles`              |
| Execute shell        | `execute`, `shell`, `runCommands`         |
| Delegate to agent    | `agent` (CLI) / `runSubagent` (VS Code)   |
| Web fetch/search     | `web`, `WebFetch`, `WebSearch`            |
| GitHub MCP tools     | `github/*` or `github/<tool-name>`        |

### Minimal valid frontmatter

```yaml
---
name: my-agent
description: 'One sentence: what this agent does and when to use it.'
tools:
  - read
  - search
---
```

### Minimal frontmatter with repo-local model

```yaml
---
name: my-agent
description: 'One sentence describing expertise and when to invoke this agent.'
tools:
  - read
  - search
  - codebase
model: claude-sonnet-4.6
---
```

### File placement

| Scope     | Copilot CLI / VS Code    | Claude Code              | Plugin                               |
|:----------|:-------------------------|:-------------------------|:-------------------------------------|
| Project   | `.github/agents/`        | `.claude/agents/`        | `packages/<domain>/.apm/agents/`     |
| Global    | `~/.copilot/agents/`     | `~/.claude/agents/`      | —                                    |
