---
name: ts-mcp-server-generator
description: 'Generate MCP server in TypeScript with tools, resources, prompts. @modelcontextprotocol/sdk + zod.'
---

Generate MCP server in TypeScript.

## Stack
- `@modelcontextprotocol/sdk` — McpServer, transports
- `zod` — schema validation
- `node` 22+, `tsx` for dev

## Steps

### Phase 1 — Scaffold

Checkpoint: Project created, deps installed.

Run script (recommended):
```powershell
pwsh scripts/New-McpServer.ps1 -ServerName my-mcp-server
```

Manual:
```powershell
mkdir my-mcp-server && cd my-mcp-server
# Copy templates/package.json, templates/tsconfig.json, templates/src/index.ts
npm install
```

### Phase 2 — Implement

Checkpoint: Tools, resources, prompts registered.

See `templates/examples/tool-registration.ts` for tool pattern.
See `templates/examples/resource-prompt-registration.ts` for resources + prompts.

### Phase 3 — Configure & Test

Checkpoint: Server running, tools validated.

See `templates/examples/transport-config.ts` for transport + env validation.

Test with MCP Inspector:
```powershell
npx @modelcontextprotocol/inspector node dist/index.js
```

## Conventions

- Always provide `title` for tools/resources/prompts
- Return `isError: true` on failure — never throw
- Import from specific SDK paths: `@modelcontextprotocol/sdk/server/mcp.js`
- ESM only: `"type": "module"` in package.json

## Gotchas

- Don't throw from tool handlers — return `isError: true`
- MCP Inspector works only with stdio (HTTP needs external client)
- Resource URIs must be valid
- Env validation before server start, not in tools
