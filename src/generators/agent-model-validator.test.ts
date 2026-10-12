import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { CLAUDE_MODEL_ALIASES, OPENCODE_MODEL_IDS } from './agent-models';
import { findAgentFiles } from './agent-size-validator';

interface AgentModels {
  claude?: string;
  opencode?: string;
}

function readModels(filePath: string): AgentModels {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(filePath, 'utf-8'));
  const meta = (match ? parse(match[1]) : {})?.metadata ?? {};
  return { claude: meta.claude?.model, opencode: meta.opencode?.model };
}

const agentFiles = findAgentFiles(path.resolve(__dirname, '../../packages'));

describe('agent model ids', () => {
  it('finds the agent files', () => {
    expect(agentFiles.length).toBeGreaterThan(0);
  });

  it.each(agentFiles.map((f) => [path.basename(f), f]))('%s uses allowed model ids', (_name, file) => {
    const { claude, opencode } = readModels(file);
    expect(CLAUDE_MODEL_ALIASES as readonly string[], `claude model "${claude}"`).toContain(claude);
    if (opencode !== undefined) {
      expect(OPENCODE_MODEL_IDS as readonly string[], `opencode model "${opencode}"`).toContain(opencode);
    }
  });
});
