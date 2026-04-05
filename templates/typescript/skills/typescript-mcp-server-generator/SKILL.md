---
name: typescript-mcp-server-generator
description: 'Generate a complete MCP server in TypeScript with tools, resources, and prompts using @modelcontextprotocol/sdk and zod validation.'
allowed-tools: codebase editFiles runCommands
---

Generate a complete, production-ready Model Context Protocol (MCP) server in TypeScript.

## Stack
- **`@modelcontextprotocol/sdk`** — official MCP SDK (`McpServer`, transports)
- **`zod`** — schema validation and type inference for tool inputs/outputs
- **`node`** — Node.js 22+ LTS runtime; `tsx` or `ts-node` for development

## Steps

### 1. Scaffold the project
```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install --save-dev typescript tsx @types/node
npx tsc --init --module nodenext --target es2022 --outdir dist --rootdir src --strict true
```
Set `"type": "module"` in `package.json`; add `build`, `dev` (tsx watch), and `start` scripts.

### 2. Create McpServer and register tools
```typescript
// src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-mcp-server', version: '1.0.0' });

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

## Key Conventions
- Always provide `title` for tools, resources, and prompts (not just `name`)
- Return `isError: true` for failures — do not throw from tool handlers
- Import from specific SDK paths (e.g., `@modelcontextprotocol/sdk/server/mcp.js`)
- Use ES module imports only (`"type": "module"` in package.json)

