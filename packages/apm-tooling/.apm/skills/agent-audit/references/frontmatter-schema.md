## Agent Frontmatter Schema

Use this file when an agent needs the shared frontmatter rules.

> **Platform note:** The fields below are based on the official GitHub Copilot custom agent
> documentation and the Claude Code subagent specification. Claude Code documents `model`
> as an official optional field; GitHub Copilot silently ignores unknown frontmatter fields.
> Treat `model` as a repo-local convention for Copilot agents. Platform-specific fields are listed separately.

### Required fields (all platforms)

| Field         | Rules                                                                                                                                                                                               |
|:--------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `name`        | Kebab-case only, 1-64 chars, must match the filename exactly, no leading/trailing/consecutive hyphens. **Always set** — even though GitHub marks it as optional, it is required in this repository. |
| `description` | **Required.** One sentence, imperative phrasing, shown in @-picker, answers "when should I use this agent?", includes trigger keywords.                                                             |

### Optional cross-platform fields

| Field   | Rules                                                                                                                                                                                                                                                                                    |
|:--------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `tools` | List of tool aliases. Minimal — grant only what the agent requires. Omit for full access; use `[]` to disable all tools.                                                                                                                                                                 |
| `model` | Official optional field in Claude Code; repo-local advisory convention in GitHub Copilot (silently ignored by official loaders). Claude Code values: `sonnet`, `opus`, `haiku`, full model ID, or `inherit`. Align value with `docs/model-overview.md`. |

### Platform-specific fields

| Field                      | Platform            | Description                                                                                             |
|:---------------------------|:--------------------|:--------------------------------------------------------------------------------------------------------|
| `user-invocable`           | Copilot / Cloud     | `false` for sub-agents that should not be manually selected by users                                    |
| `disable-model-invocation` | Cloud Agent         | `true` to prevent auto-invocation based on task context (replaces retired `infer`)                      |
| `target`                   | Copilot CLI / Cloud | `vscode` or `github-copilot`. **Do not set unless explicitly targeting one environment.** Unset = both. |
| `mcp-servers`              | Cloud Agent         | Additional MCP servers. Not used in VS Code / IDE agents.                                               |
| `metadata`                 | Cloud Agent         | Key-value annotation pairs. Not used in VS Code / IDE agents.                                           |
| `argument-hint`            | VS Code             | Placeholder text shown in the chat input box                                                            |
| `permissionMode`           | Claude Code         | `default` \| `acceptEdits` \| `bypassPermissions` \| `plan`                                             |
| `maxTurns`                 | Claude Code         | Maximum agentic turns before stopping                                                                   |
| `isolation`                | Claude Code         | `shared` (default) or `isolated` (fresh context per invocation)                                         |
| `disallowedTools`          | Claude Code         | Tools the agent may NOT use (overrides `tools`)                                                         |
| `color`                    | Claude Code         | Terminal color: `red` \| `green` \| `blue` \| `yellow` \| `magenta` \| `cyan` \| `white`                |

> ⚠️ `infer` is **retired** — use `disable-model-invocation` and `user-invocable` instead.
> Do not use `target` unless explicitly needed; omitting it makes the agent available everywhere.
> Do not use platform-specific fields for agents intended for multiple platforms.

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

### Minimal frontmatter with model

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

| Scope     | Copilot CLI / VS Code    | Claude Code              | opencode                    | Plugin                               |
|:----------|:-------------------------|:-------------------------|:----------------------------|:-------------------------------------|
| Project   | `.github/agents/`        | `.claude/agents/`        | `.opencode/agents/`         | `packages/<domain>/.apm/agents/`     |
| Global    | `~/.copilot/agents/`     | `~/.claude/agents/`      | `~/.config/opencode/agents/`| —                                    |

### Official GitHub Copilot frontmatter reference (source: docs, 2025-05-03)

| Property                   | Type                | Purpose                                                                          |
|:---------------------------|:--------------------|:---------------------------------------------------------------------------------|
| `name`                     | string (optional*)  | Display name for the custom agent. *Required by repo convention.*                |
| `description`              | **Required** string | Description of the custom agent's purpose and capabilities.                      |
| `target`                   | string              | `vscode` or `github-copilot`. Unset = both. Do not set unless explicitly needed. |
| `tools`                    | list / string       | Tool names the agent can use. Unset = all tools.                                 |
| `model`                    | string              | Model to use (Claude Code) or repo-local convention (Copilot). Unset = inherits default. |
| `disable-model-invocation` | boolean             | Disables cloud agent auto-use. `true` = manual selection only. Replaces `infer`. |
| `user-invocable`           | boolean             | Can the user manually select this agent? Unset = `true`.                         |
| `infer`                    | boolean             | **Retired.** Use `disable-model-invocation` and `user-invocable` instead.        |
| `mcp-servers`              | object              | Additional MCP servers. **Not used in VS Code / IDE agents.**                    |
| `metadata`                 | object              | Key-value annotation. **Not used in VS Code / IDE agents.**                      |

