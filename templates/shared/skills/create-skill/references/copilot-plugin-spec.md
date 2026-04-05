# GitHub Copilot CLI Plugin Spec

Reference: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference

## Plugin Directory Structure

```
<plugin-name>/
├── plugin.json           ← generated from plugin.config.yml by copilot-hub
├── agents/               ← agent definitions (.agent.md files)
├── skills/               ← skill directories (each with SKILL.md)
├── prompts/              ← prompt definitions
├── instructions/         ← instruction files
├── commands/             ← executable commands (CLI scripts)
├── hooks/                ← lifecycle hook definitions
└── mcp/                  ← MCP server configuration
```

## plugin.json Fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Plugin display name |
| `description` | string | One-sentence description |
| `version` | string | Semantic version |
| `homepage` | string | URL to project/docs |
| `author` | object | `{ name, url }` |
| `category` | string | Plugin category |
| `tags` | string[] | Search tags |
| `agents` | object[] | Agent definitions |
| `skills` | object[] | Skill definitions |
| `commands` | object[] | CLI command definitions |
| `hooks` | object | Lifecycle hooks configuration |
| `mcpServers` | object | MCP server configuration |
| `lspServers` | object | LSP server configuration |

> **Note:** `instructions` is **not** a valid `plugin.json` field — instructions are an IDE concept, not a Copilot CLI concept. Instruction files are bundled in the plugin directory but not listed in `plugin.json`.

## Agent Definition
```json
{
  "name": "agent-name",
  "description": "One-sentence description for auto-selection",
  "source": "./agents/agent-name.agent.md"
}
```

## Skill Definition
```json
{
  "name": "skill-name",
  "description": "One-sentence description",
  "source": "./skills/skill-name/"
}
```

## `.agent.md` Required Frontmatter
```yaml
---
name: agent-name
description: 'What the agent does — used for auto-selection'
mode: agent
tools: editFiles codebase runCommands problems
---
```

## `commands/` vs `scripts/`
| Context | Directory | Purpose |
|---|---|---|
| **Plugin** (`plugin.json`) | `commands/` | CLI commands invoked by users directly |
| **Skill** (agentskills.io) | `scripts/` | Automation helpers invoked by the agent |

Both are executable scripts. The difference is the caller: `commands/` is for users, `scripts/` is for the agent.
