import * as fs from 'fs';
import { parse } from 'yaml';

/** Allowed `metadata.claude.model` values. */
export const ALLOWED_CLAUDE_MODELS: readonly string[] = ['haiku', 'sonnet', 'opus', 'inherit'];

/**
 * Allowed `metadata.opencode.model` ids, one per tier. Bump a model here (one line) and in the agent files;
 * keep docs/concepts/agent-frontmatter.md in sync.
 */
export const OPENCODE_MODEL_BY_TIER = {
  haiku: 'anthropic/claude-haiku-5-5',
  sonnet: 'anthropic/claude-sonnet-5-5',
  opus: 'anthropic/claude-opus-5-5',
} as const;

export const ALLOWED_OPENCODE_MODELS: readonly string[] = Object.values(OPENCODE_MODEL_BY_TIER);

export interface AgentModelViolation {
  filePath: string;
  field: 'metadata.claude.model' | 'metadata.opencode.model';
  value: string;
}

function readMetadata(content: string): Record<string, any> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = parse(match[1]);
  return data?.metadata ?? {};
}

/** Checks model ids in agent frontmatter against the allowed lists. */
export function checkAgentModels(agentFiles: string[]): AgentModelViolation[] {
  const violations: AgentModelViolation[] = [];
  for (const filePath of agentFiles) {
    const metadata = readMetadata(fs.readFileSync(filePath, 'utf8'));
    const claude = metadata.claude?.model;
    if (claude !== undefined && !ALLOWED_CLAUDE_MODELS.includes(String(claude))) {
      violations.push({ filePath, field: 'metadata.claude.model', value: String(claude) });
    }
    const opencode = metadata.opencode?.model;
    if (opencode !== undefined && !ALLOWED_OPENCODE_MODELS.includes(String(opencode))) {
      violations.push({ filePath, field: 'metadata.opencode.model', value: String(opencode) });
    }
  }
  return violations;
}
