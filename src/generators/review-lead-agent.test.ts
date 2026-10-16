import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'packages/agents/.apm/agents/review-lead.agent.md'), 'utf-8');
const fm: any = parse(source.match(/^---\n([\s\S]*?)\n---\n/)![1]);
const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');
const fanout = fs.readFileSync(path.join(root, 'packages/delivery/.apm/skills/review-fanout/SKILL.md'), 'utf-8');
const agentsApm: any = parse(fs.readFileSync(path.join(root, 'packages/agents/apm.yml'), 'utf-8'));

describe('review-lead agent contract', () => {
  it('is read-only with a pinned sonnet model', () => {
    expect(fm.name).toBe('review-lead');
    expect(fm.metadata.claude.model).toBe('sonnet');
    expect(fm.metadata.opencode.model).toBe('anthropic/claude-sonnet-5-5');
    expect(fm.metadata.claude.tools).toEqual(['Agent', 'Read', 'Grep', 'Glob', 'Bash', 'Skill']);
    for (const t of ['Edit', 'Write', 'AskUserQuestion']) expect(fm.metadata.claude.tools).not.toContain(t);
    expect(fm.tools).not.toContain('edit');
    expect(fm.metadata.claude.skills).toEqual(['review-fanout']);
    expect(fm.metadata.opencode.mode).toBe('subagent');
    expect(fm.metadata.opencode.permission.edit).toBe('deny');
    expect(fm.metadata.opencode.permission.task).toBe('allow');
  });

  it('returns the output keys as JSON only within 300 words', () => {
    for (const key of ['"verdict"', '"incomplete"', '"findings"', '"severity"', '"file"', '"line"', '"title"', '"blocking"', '"package"', '"review"']) {
      expect(body).toContain(key);
    }
    expect(body).toContain('"APPROVE"|"CHANGES_REQUESTED"');
    expect(body).toContain('.agents/<issue>/review.json');
    expect(body).toMatch(/one JSON object and nothing else, at most 300 words/);
    expect(body).toMatch(/"error"/);
  });

  it('takes range, issue and context.md and dispatches only reviewer and the verify sub-agent', () => {
    expect(body).toContain('`<base>..<head>`');
    expect(body).toContain('context.md');
    expect(body).toMatch(/only agents you dispatch are `reviewer`.*verify sub-agent/);
    expect(body).toMatch(/never `implementer`, `pr-writer` or another `review-lead`/);
    expect(body).toContain('`review-fanout`');
  });

  it('stays within the size limit and is registered in the package', () => {
    expect(body.trim().split('\n').length).toBeLessThanOrEqual(40);
    expect(agentsApm.agents).toContain('review-lead');
    expect(agentsApm.description).toContain('review-lead');
  });

  it('review-fanout says reviewer is dispatched only from review-fanout wherever it runs', () => {
    expect(fanout).toMatch(/only from `review-fanout`, wherever it runs/);
  });
});
