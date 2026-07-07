---
name: ng-ag-grid-mcp-setup
description: >
  Use this skill when setting up the AG Grid MCP server (`ag-mcp`) for the first time
  in a project. Installs the correct configuration for VS Code, Claude Code, or Cursor
  so the LLM can access version-specific AG Grid documentation, examples, and API refs.
---

## Overview

AG Grid MCP server (`ag-mcp`) gives LLM access to version-specific AG Grid docs, examples, and API references via local MCP server started with `npx ag-mcp`.

No global install needed — `npx` downloads and runs latest version on demand.

## Step 1 — Detect client

Ask user or detect from context which AI client in use:

- **VS Code + GitHub Copilot** → create `.vscode/mcp.json`
- **Claude Code** → create `mcp.json` in project root
- **Cursor** → create `mcp.json` in project root

If config file exists, read and merge — don't overwrite existing servers.

## Step 2 — Install config

### VS Code

Copy `templates/.vscode/mcp.json` to `.vscode/mcp.json` in project root.
If `.vscode/mcp.json` exists, add `ag-mcp` server block to `servers` object.

### Claude Code / Cursor

Copy `templates/mcp.json` to `mcp.json` in project root.
If `mcp.json` exists, add `ag-mcp` block to `mcpServers` object.

### Cursor (one-click)

Alternatively, user can open this URL in browser to auto-install:
```
https://cursor.com/en/install-mcp?name=ag-mcp&config=eyJjb21tYW5kIjoibnB4IGFnLW1jcCJ9
```

## Step 3 — Verify

After config creation, tell user to:

1. Reload/restart AI client (VS Code: reload window; Claude Code: restart; Cursor: restart)
2. Confirm server active:
   - VS Code: open chat and type `@ag-mcp` — server should appear
   - Claude Code: run `claude mcp list` and check for `ag-mcp`

## Using ag-mcp

Once installed, LLM uses server automatically. Users trigger directly:

| Action | VS Code / Claude | Description |
|---|---|---|
| Create new grid | `/ag-mcp:quick-start` | Scaffolds AG Grid for detected framework |
| Upgrade version | `/ag-mcp:upgrade-grid` | Step-by-step migration plan |
| Search docs | Use `search_docs` tool | Natural language query against versioned docs |

## Gotchas

- `ag-mcp` requires Node.js ≥ 18. Run `node --version` to verify before configuring.
- Server auto-detects AG Grid version from `package.json` — no manual version config needed.
- In monorepos, if auto-detection picks wrong package, call `set_version` tool manually.
- Don't add `ag-mcp` to `devDependencies` — `npx ag-mcp` always fetches latest CLI; pinning not recommended.
