import * as fs from 'fs';
import * as path from 'path';

/** Agents are contracts, not manuals: the body after the frontmatter stays short. */
export const AGENT_BODY_LINE_LIMIT = 40;

export interface AgentSizeViolation {
  filePath: string;
  bodyLines: number;
  limit: number;
}

/**
 * Collects all agent files under a packages base directory
 * (packages/<domain>/.apm/agents/<name>.agent.md)
 */
export function findAgentFiles(packagesBaseDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(packagesBaseDir)) return results;

  for (const domain of fs.readdirSync(packagesBaseDir)) {
    const agentsDir = path.join(packagesBaseDir, domain, '.apm', 'agents');
    if (!fs.existsSync(agentsDir)) continue;
    for (const file of fs.readdirSync(agentsDir)) {
      if (file.endsWith('.agent.md')) results.push(path.join(agentsDir, file));
    }
  }
  return results;
}

/** Lines after the closing frontmatter delimiter, ignoring leading and trailing blank lines. */
export function countBodyLines(content: string): number {
  const lines = content.split('\n');
  let start = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    start = end === -1 ? 0 : end + 1;
  }
  const body = lines.slice(start);
  while (body.length && body[0].trim() === '') body.shift();
  while (body.length && body[body.length - 1].trim() === '') body.pop();
  return body.length;
}

/** Checks all agent files and returns violations over the body line limit */
export function checkAgentSizes(agentFiles: string[]): AgentSizeViolation[] {
  return agentFiles
    .map((filePath) => {
      const bodyLines = countBodyLines(fs.readFileSync(filePath, 'utf8'));
      return { filePath, bodyLines, limit: AGENT_BODY_LINE_LIMIT };
    })
    .filter((v) => v.bodyLines > v.limit);
}
