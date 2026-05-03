## Agent Frontmatter Reference

Cross-platform field compatibility for `.agent.md` files across Copilot CLI, VS Code, and Claude Code.

### Load this reference when

- Target platform is `claude` or `all`
- You need platform-specific fields (`permissionMode`, `user-invocable`, `infer`, etc.)
- Validating cross-platform compatibility before writing frontmatter

---

## Minimum Cross-Platform Fields

These fields work in all three runtimes:

```yaml
---
name: my-agent           # kebab-case; file name must match
description: '...'       # one sentence shown in @-picker
tools:                   # list of tool aliases (see below)
  - read
  - search
model: claude-sonnet-4.6 # officially supported by Claude Code; advisory for Copilot CLI/VS Code
---
```

---

## Tool Aliases (Cross-Platform)

| Capability           | Use in `tools:`                          |
|:---------------------|:-----------------------------------------|
| Read files           | `read`                                   |
| Search files/text    | `search`                                 |
| Semantic search      | `codebase`                               |
| Create/edit files    | `write`, `edit`, `editFiles`             |
| Execute shell        | `execute`, `shell`, `runCommands`        |
| Delegate to agent    | `agent` (CLI) / `runSubagent` (VS Code)  |
| Web fetch/search     | `web`, `WebFetch`, `WebSearch`           |
| GitHub MCP tools     | `github/*` or `github/<tool-name>`       |

Omit `tools:` entirely (or use `["*"]`) to grant all available tools.
Use `[]` to disable all tools.

---

## Platform-Specific Fields

### Copilot CLI only

| Field            | Type    | Description                                             |
|:-----------------|:--------|:--------------------------------------------------------|
| `user-invocable` | boolean | `false` = agent is called by other agents, not by users |
| `infer`          | boolean | `false` = disable automatic inference/delegation        |

```yaml
user-invocable: false
```

### VS Code / Copilot Chat only

| Field           | Type   | Description                                        |
|:----------------|:-------|:---------------------------------------------------|
| `target`        | string | `vscode` \| `jetbrains` \| `all`                  |
| `argument-hint` | string | Shown as placeholder in the chat input             |
| `infer`         | boolean | `false` = disable automatic inference             |

```yaml
target: vscode
argument-hint: "path to file or directory"
```

### Claude Code only

| Field            | Type    | Description                                                                  |
|:-----------------|:--------|:-----------------------------------------------------------------------------|
| `permissionMode` | string  | `default` \| `acceptEdits` \| `bypassPermissions` \| `plan`                 |
| `disallowedTools`| list    | Tools the agent may NOT use (overrides `tools`)                              |
| `maxTurns`       | integer | Maximum number of agentic turns before stopping                              |
| `color`          | string  | Terminal color: `red` \| `green` \| `blue` \| `yellow` \| `magenta` \| `cyan` \| `white` |
| `mcpServers`     | object  | MCP server configuration (same format as `.claude/settings.json`)           |
| `hooks`          | object  | Lifecycle hooks: `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`         |
| `initialPrompt`  | string  | Auto-sent as first user message when agent is invoked                        |
| `isolation`      | string  | `shared` (default) or `isolated` (fresh context)                            |
| `background`     | boolean | Run as background agent                                                      |

```yaml
permissionMode: acceptEdits
maxTurns: 20
color: blue
```

> `permissionMode: bypassPermissions` skips all approval prompts — use only in trusted
> automated environments.

---

## File Placement

| Platform  | Project scope                | Global scope                   |
|:----------|:-----------------------------|:-------------------------------|
| CLI       | `.github/agents/`            | `~/.copilot/agents/`           |
| VS Code   | `.github/agents/`            | `~/.github/agents/`            |
| Claude    | `.claude/agents/`            | `~/.claude/agents/`            |
| Plugin    | `packages/<domain>/.apm/agents/` | —                          |

Higher-priority locations win when multiple agents share the same `name`:
- Managed settings > `--agents` CLI flag > project (`.github/`/`.claude/`) > global (`~/`) > plugin

---

## Cross-Platform Template

For agents targeting all three platforms, use only the minimum cross-platform fields:

```yaml
---
name: my-agent
description: 'One sentence describing expertise and when to use this agent.'
tools:
  - read
  - search
  - codebase
model: claude-sonnet-4.6
---
```

Add platform-specific fields in a comment if documentation is needed:
```yaml
# CLI only: user-invocable: false
# Claude only: permissionMode: acceptEdits
# VS Code only: target: vscode
```

---

## Further Reading

- [GitHub Copilot CLI — Custom Agent Configuration](https://docs.github.com/en/copilot/reference/custom-agents-configuration)
- [Claude Code — Subagents](https://code.claude.com/docs/en/sub-agents)
- [Designing Agents](../../../../docs/best-practices/designing-agents.md)
