---
applyTo: "**"
---

# Azure DevOps MCP Server

This project uses the Azure DevOps MCP server (`@azure-devops/mcp`). The server provides all `ado/*` tools used by agents in this package.

## Available Tool Domains

| Domain | Tools |
|---|---|
| `core` | Projects, teams, iterations |
| `work-items` | Create, read, update, link work items |
| `repositories` | Repos, branches, PRs, PR threads, diffs |
| `pipelines` | Build and release pipelines |
| `advanced-security` | CodeQL alerts, dependency scanning |

## Setup & Configuration

The org name in `apm.yml` is hardcoded to `RWEST-MTI-AC`. This is an APM limitation:
`${input:...}` substitution only works in `env:` / `headers:` — not in `args:` — and only in VS Code.

**To reconfigure for a different org:**
```powershell
apm install --mcp azure-devops -- npx -y @azure-devops/mcp YOUR_ORG_NAME
```

**VS Code users** — after `apm install`, you can manually edit `.vscode/mcp.json` to use a runtime prompt:
```json
{
  "servers": {
    "azure-devops": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "${input:ado_org}"],
      "inputs": [{ "id": "ado_org", "type": "promptString", "description": "ADO org name" }]
    }
  }
}
```

**Note:** APM MCP servers are always project-scoped. `apm install -g --mcp` is not supported.

Always use tools from this MCP server for any Azure DevOps operation — do not use REST API calls directly.
