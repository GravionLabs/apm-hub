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
  field:
    | 'frontmatter'
    | 'metadata'
    | 'metadata.claude'
    | 'metadata.opencode'
    | 'metadata.claude.model'
    | 'metadata.opencode.model';
  value: string;
}

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Checks model ids in agent frontmatter against the allowed lists. Malformed frontmatter is reported, not thrown. */
export function checkAgentModels(agentFiles: string[]): AgentModelViolation[] {
  const violations: AgentModelViolation[] = [];
  for (const filePath of agentFiles) {
    const add = (field: AgentModelViolation['field'], value: string) => violations.push({ filePath, field, value });
    const match = fs.readFileSync(filePath, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) continue;
    let data: unknown;
    try {
      data = parse(match[1]);
    } catch (e) {
      add('frontmatter', e instanceof Error ? e.message : String(e));
      continue;
    }
    if (!isDict(data)) {
      add('frontmatter', 'not a mapping');
      continue;
    }
    if (!('metadata' in data)) continue;
    if (!isDict(data.metadata)) {
      add('metadata', 'not a mapping');
      continue;
    }
    const checks = [
      ['claude', ALLOWED_CLAUDE_MODELS],
      ['opencode', ALLOWED_OPENCODE_MODELS],
    ] as const;
    for (const [key, allowed] of checks) {
      if (!(key in data.metadata)) continue;
      const section = data.metadata[key];
      if (!isDict(section)) {
        add(`metadata.${key}`, 'not a mapping');
        continue;
      }
      if (!('model' in section)) continue;
      if (!allowed.includes(String(section.model))) add(`metadata.${key}.model`, String(section.model));
    }
  }
  return violations;
}
