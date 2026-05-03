---
name: typescript-mcp-server-generator
description: 'Generate a complete MCP server in TypeScript with tools, resources, and prompts using @modelcontextprotocol/sdk and zod validation.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
chronicle-hints: 'single-purpose, structured-output, phases'
---

Generate a complete, production-ready Model Context Protocol (MCP) server in TypeScript.

## Stack
- **`@modelcontextprotocol/sdk`** — official MCP SDK (`McpServer`, transports)
- **`zod`** — schema validation and type inference for tool inputs/outputs
- **`node`** — Node.js 22+ LTS runtime; `tsx` for development

## Steps

### Phase 1 — Scaffold

✓ Checkpoint: Project created, dependencies installed, ready to add tools

**Run the scaffold script** (recommended):
```powershell
pwsh scripts/New-McpServer.ps1 -ServerName my-mcp-server
```
The script creates the project directory, copies starter templates, and runs `npm install`.

**Alternatively — manual:**
```powershell
mkdir my-mcp-server
cd my-mcp-server
# Copy templates/package.json, templates/tsconfig.json, templates/src/index.ts
npm install
```

### Phase 2 — Implement Tools & Resources

✓ Checkpoint: All tools, resources, and prompts registered; ready to test

**Register tools:**
```typescript
server.registerTool(
  'tool-name',
  {
    title: 'Human-Readable Title',
    description: 'What this tool does — shown to the LLM',
    inputSchema: { param: z.string().describe('Parameter description') },
  },
  async ({ param }) => {
    try {
      return { content: [{ type: 'text', text: await doWork(param) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: `Error: ${err}` }] };
    }
  }
);
```

**Register resources and prompts (optional):**
```typescript
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
server.registerResource('name', new ResourceTemplate('resource://{id}', { list: undefined }),
  { title: 'Title', description: '...' },
  async (uri, { id }) => ({ contents: [{ uri: uri.href, text: await fetchData(id) }] })
);
server.registerPrompt('prompt-name',
  { title: 'Title', description: '...', argsSchema: { topic: z.string() } },
  ({ topic }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `About: ${topic}` } }] })
);
```

### Phase 3 — Configure & Test

✓ Checkpoint: Server running; tools validated with MCP Inspector

**Connect transport:**
```powershell
# stdio (local/CLI)
await server.connect(new StdioServerTransport());

# HTTP (remote) — use StreamableHTTPServerTransport with Express
# Expose POST /mcp endpoint
```

**Validate and test:**
```powershell
# Validate env vars with zod at startup
$env = z.object({ API_KEY: z.string() }).parse([Environment]::GetEnvironmentVariables())

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## Template Files
| File | Purpose |
|---|---|
| `templates/package.json` | Starter: `@modelcontextprotocol/sdk`, `zod`, `tsx`; ESM `"type": "module"` |
| `templates/tsconfig.json` | NodeNext module resolution, strict mode, sourceMap |
| `templates/src/index.ts` | Minimal `McpServer` + `StdioServerTransport` skeleton with example tool |

## Scripts
- **`scripts/New-McpServer.ps1`** — Scaffold automation. Params: `-ServerName` (required), `-OutputDirectory`

## Key Conventions
- Always provide `title` for tools, resources, and prompts
- Return `isError: true` for failures — do not throw from tool handlers
- Import from specific SDK paths (e.g., `@modelcontextprotocol/sdk/server/mcp.js`)
- Use ES module imports only (`"type": "module"` in package.json)

## Gotchas
- Don't throw errors from tool handlers — always return `isError: true`
- MCP Inspector only works with stdio transport (HTTP requires external client)
- Resource URIs must be valid (e.g., `resource://{id}` with proper substitution)
- Environment validation must happen before server starts, not in tools

## Output Format

### ✅ Summary
MCP server `{server-name}` generated at `{path}` with `{N}` tools registered and {resources/prompts}.

### 📝 What Changed
- Project: `{path}/` (created)
- Tools registered: {count} ({names listed})
- Resources: {count} (if any)
- Prompts: {count} (if any)
- Transport: {stdio/HTTP}
- Dependencies: installed and locked

### ✔️ Verify
```powershell
# Check scaffold
Test-Path "{path}/src/index.ts"
Test-Path "{path}/package.json"
Test-Path "{path}/node_modules"

# Validate TypeScript
npm run build

# Test with Inspector
npx @modelcontextprotocol/inspector node dist/index.js
# (Should show all tools in Inspector UI)
```

### 🚀 Next Steps
1. Register additional tools as needed (follow pattern in src/index.ts)
2. Test each tool with MCP Inspector
3. Deploy: stdio (CLI) or HTTP (remote client)
4. Document tool schemas in README.md
