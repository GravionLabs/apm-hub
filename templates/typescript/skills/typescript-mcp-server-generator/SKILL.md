---
name: typescript-mcp-server-generator
description: 'Generate a complete MCP server in TypeScript with tools, resources, and prompts using @modelcontextprotocol/sdk and zod validation.'
allowed-tools: codebase editFiles runCommands
model: claude-sonnet-4.6
---

Generate a complete, production-ready Model Context Protocol (MCP) server in TypeScript.

## Stack
- **`@modelcontextprotocol/sdk`** — official MCP SDK (`McpServer`, transports)
- **`zod`** — schema validation and type inference for tool inputs/outputs
- **`node`** — Node.js 22+ LTS runtime; `tsx` for development

## Steps

### 1. Scaffold the project
**Run the scaffold script** (recommended):
```powershell
pwsh scripts/New-McpServer.ps1 -ServerName my-mcp-server
```
The script creates the project directory, copies starter templates, and runs `npm install`.

**Alternatively — manual:**
```bash
mkdir my-mcp-server && cd my-mcp-server
# Copy templates/package.json, templates/tsconfig.json, templates/src/index.ts
npm install
```

### 2. Register tools
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

### 3. Register resources and prompts (optional)
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

### 4. Connect transport
**stdio** (local/CLI): `await server.connect(new StdioServerTransport());`

**HTTP** (remote): Use `StreamableHTTPServerTransport` with Express — expose a POST `/mcp` endpoint.

### 5. Validate config and test
```bash
# Validate env vars with zod at startup
const env = z.object({ API_KEY: z.string() }).parse(process.env);
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

## Tips
> **Use the `task` tool** for scaffolding — it's mechanical. Example:
> `#task pwsh scripts/New-McpServer.ps1 -ServerName "my-tool-server"`

