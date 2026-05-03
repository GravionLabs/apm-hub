import { describe, it, expect } from 'vitest';
import { isCopilotAvailable, createTestSession, REPO_ROOT } from '../harness/copilot-harness.js';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const GITHUB_AGENTS_DIR = join(REPO_ROOT, '.github', 'agents');
const skip = !isCopilotAvailable();

describe('Agent file structure (static, always runs)', () => {
  it('should have .github/agents directory', () => {
    expect(existsSync(GITHUB_AGENTS_DIR)).toBe(true);
  });

  it('should have valid frontmatter in each .agent.md file', () => {
    if (!existsSync(GITHUB_AGENTS_DIR)) return;
    const agentFiles = readdirSync(GITHUB_AGENTS_DIR)
      .filter(f => f.endsWith('.agent.md'));
    expect(agentFiles.length).toBeGreaterThan(0);
    for (const file of agentFiles) {
      const content = readFileSync(join(GITHUB_AGENTS_DIR, file), 'utf8');
      expect(content, `${file} should start with YAML frontmatter`).toMatch(/^---\n/);
      expect(content, `${file} should contain 'name:' field`).toContain('name:');
      expect(content, `${file} should contain 'description:' field`).toContain('description:');
    }
  });
});

describe.skipIf(skip)('Agent loading via Copilot SDK', () => {
  it('should register a custom agent and list it', async () => {
    const { client, session } = await createTestSession({
      agentPrompt: 'You are a concise code reviewer.',
    });
    try {
      const result = await session.rpc.agent.list();
      expect(result.agents).toBeDefined();
      expect(result.agents.some((a: { name: string }) => a.name === 'test-agent')).toBe(true);
    } finally {
      await session.disconnect();
      await client.stop();
    }
  }, 60_000);
});
