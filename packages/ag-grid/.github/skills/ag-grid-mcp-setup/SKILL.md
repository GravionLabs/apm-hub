---
name: ag-grid-mcp-setup
description: >
  Use this skill when setting up the AG Grid MCP server (`ag-mcp`) for the first time
  in a project. Installs the correct configuration for VS Code, Claude Code, or Cursor
  so the LLM can access version-specific AG Grid documentation, examples, and API refs.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
---

## Overview

The AG Grid MCP server (`ag-mcp`) gives your LLM access to version-specific AG Grid
documentation, examples, and API references via a local MCP server started with `npx ag-mcp`.

No global install is needed — `npx` downloads and runs the latest version on demand.

## Step 1 — Detect the client

Ask the user (or detect from context) which AI client is in use:

- **VS Code + GitHub Copilot** → create `.vscode/mcp.json`
- **Claude Code** → create `mcp.json` in the project root
- **Cursor** → create `mcp.json` in the project root

If a config file already exists, read it first and merge — do not overwrite existing servers.

## Step 2 — Install the config

### VS Code

Copy `templates/.vscode/mcp.json` to `.vscode/mcp.json` in the project root.
If `.vscode/mcp.json` already exists, add the `ag-mcp` server block to the `servers` object.

### Claude Code / Cursor

Copy `templates/mcp.json` to `mcp.json` in the project root.
If `mcp.json` already exists, add the `ag-mcp` block to the `mcpServers` object.

### Cursor (one-click)

Alternatively, the user can open this URL in a browser to auto-install:
```
https://cursor.com/en/install-mcp?name=ag-mcp&config=eyJjb21tYW5kIjoibnB4IGFnLW1jcCJ9
```

## Step 3 — Verify

After creating the config, tell the user to:

1. Reload/restart the AI client (VS Code: reload window; Claude Code: restart; Cursor: restart)
2. Confirm the server is active:
   - VS Code: open a chat and type `@ag-mcp` — the server should appear
   - Claude Code: run `claude mcp list` and check for `ag-mcp`

## Using ag-mcp

Once installed, the LLM uses the server automatically. Users can also trigger it directly:

| Action | VS Code / Claude | Description |
|---|---|---|
| Create new grid | `/ag-mcp:quick-start` | Scaffolds AG Grid for the detected framework |
| Upgrade version | `/ag-mcp:upgrade-grid` | Step-by-step migration plan |
| Search docs | Use `search_docs` tool | Natural language query against versioned docs |

## Gotchas

- `ag-mcp` requires Node.js ≥ 18. Run `node --version` to verify before configuring.
- The server auto-detects the AG Grid version from `package.json` — no manual version config needed.
- In monorepos, if auto-detection picks the wrong package, call the `set_version` tool manually.
- Do not add `ag-mcp` to `devDependencies` — `npx ag-mcp` always fetches the latest CLI; pinning is not recommended.
