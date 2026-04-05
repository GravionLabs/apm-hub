---
name: typescript-mcp-server-generator
description: 'Generate a complete MCP server in TypeScript with tools, resources, and prompts using @modelcontextprotocol/sdk and zod validation.'
allowed-tools: codebase editFiles runCommands
---

Generate a complete, production-ready Model Context Protocol (MCP) server in TypeScript.

## Stack
- **`@modelcontextprotocol/sdk`** — official MCP SDK (`McpServer`, transports, utilities)
- **`zod`** — schema validation and TypeScript type inference for tool inputs/outputs
- **`node`** — Node.js 22+ LTS runtime
- **`npm`** — package manager; `tsx` or `ts-node` for development

## Steps

### 1. Scaffold the project
```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install --save-dev typescript tsx @types/node
npx tsc --init --module nodenext --target es2022 --outdir dist --rootdir src --strict true --sourcemap true
```

Add to `package.json`:
```json
{
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js"
  },
  "engines": { "node": ">=22" }
}
```

### 2. Create McpServer

```typescript
// src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'my-mcp-server',
  version: '1.0.0',
});
```

### 3. Register tools
```typescript
server.registerTool(
  'tool-name',
  {
    title: 'Human-Readable Title',
    description: 'What this tool does — shown to the LLM',
    inputSchema: {
      param: z.string().describe('Description of the parameter'),
    },
  },
  async ({ param }) => {
    try {
      const result = await doWork(param);
      return {
        content: [{ type: 'text', text: String(result) }],
        structuredContent: { result },
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  }
);
```

### 4. Register resources (optional)
```typescript
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

server.registerResource(
  'resource-name',
  new ResourceTemplate('resource://{id}', { list: undefined }),
  {
    title: 'Resource Title',
    description: 'What this resource provides',
  },
  async (uri, { id }) => ({
    contents: [{ uri: uri.href, text: await fetchData(id) }],
  })
);
```

### 5. Register prompts (optional)
```typescript
server.registerPrompt(
  'prompt-name',
  {
    title: 'Prompt Title',
    description: 'What this prompt template does',
    argsSchema: { topic: z.string() },
  },
  ({ topic }) => ({
    messages: [
      { role: 'user', content: { type: 'text', text: `Tell me about ${topic}` } },
    ],
  })
);
```

### 6. Choose transport and connect

**stdio** (for local/CLI use):
```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

**HTTP** (for remote/web use):
```typescript
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(process.env.PORT ?? 3000);
```

## Configuration
- Use environment variables for all configuration (ports, API keys, paths)
- Validate env vars with `zod` at startup:
  ```typescript
  const env = z.object({ API_KEY: z.string() }).parse(process.env);
  ```

## Testing
```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector

# For stdio servers
npx @modelcontextprotocol/inspector node dist/index.js

# For HTTP servers
npx @modelcontextprotocol/inspector http://localhost:3000/mcp
```

## Key Conventions
- Always return both `content` (for display) and `structuredContent` (for data) from tools
- Provide a `title` field for all tools, resources, and prompts (not just `name`)
- Use `isError: true` in the return value to signal tool failures (do not throw)
- Import from specific SDK paths (e.g., `@modelcontextprotocol/sdk/server/mcp.js`)
- Use ES module imports — `require()` is not supported
