import * as fs from 'fs';
import * as path from 'path';

const HOOKS_DIR = path.resolve(__dirname, '../../../packages/hooks/.apm/hooks');

type Hook = { type: string; command: string; timeout: number };
type Entry = { matcher?: string; hooks: Hook[] };
type Manifest = { hooks: Record<string, Entry[]> };

const isClaude = (event: string) => /^[A-Z]/.test(event);
const isCopilot = (event: string) => /^[a-z]/.test(event);

const manifests = fs
  .readdirSync(HOOKS_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => ({
    file: f,
    json: JSON.parse(fs.readFileSync(path.join(HOOKS_DIR, f), 'utf8')) as Manifest,
  }));

const events = manifests.flatMap((m) => Object.keys(m.json.hooks));

// Expected: one Claude event per manifest, mapped to its script.
const expected: Record<string, { event: string; matcher?: string; script: string }> = {
  'agent-sanitize.json': { event: 'SessionStart', script: 'agent-sanitize.sh' },
  'context-warning.json': { event: 'UserPromptSubmit', script: 'context-warning.sh' },
  'git-guardrails.json': { event: 'PreToolUse', matcher: 'Bash', script: 'git-guardrails.sh' },
  'subagent-ledger.json': { event: 'SubagentStop', script: 'subagent-ledger.sh' },
};

describe('hook manifests: event set per harness', () => {
  it('finds exactly the four hook manifests', () => {
    expect(manifests).toHaveLength(4);
    expect(manifests.map((m) => m.file)).toEqual(Object.keys(expected));
  });

  it('every event is PascalCase (Claude Code) or camelCase (Copilot); anything else fails', () => {
    expect(events.filter((e) => !isClaude(e) && !isCopilot(e))).toEqual([]);
  });

  it('Claude Code gets exactly SessionStart, SubagentStop, UserPromptSubmit, PreToolUse', () => {
    expect(events.filter(isClaude).sort()).toEqual([
      'PreToolUse',
      'SessionStart',
      'SubagentStop',
      'UserPromptSubmit',
    ]);
  });

  // apm 0.33.0 integrates every event of a manifest into every target, so Copilot
  // events must not be shipped (manual setup, docs/usage/copilot-hooks.md).
  it.each(manifests.map((m) => [m.file, m.json] as const))(
    '%s carries no camelCase event',
    (_file, json) => {
      expect(Object.keys(json.hooks).filter(isCopilot)).toEqual([]);
    }
  );

  it.each(manifests.map((m) => [m.file, m.json] as const))(
    '%s maps one event with one entry to its existing script',
    (file, json) => {
      const want = expected[file];
      expect(want).toBeDefined();
      expect(Object.keys(json.hooks)).toEqual([want.event]);
      const entries = json.hooks[want.event];
      expect(entries).toHaveLength(1);
      expect(entries[0].matcher).toBe(want.matcher);
      expect(entries[0].hooks).toHaveLength(1);
      const hook = entries[0].hooks[0];
      expect(hook.type).toBe('command');
      expect(hook.command).toBe(`bash ./${want.script}`);
      expect(hook.timeout).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(HOOKS_DIR, want.script))).toBe(true);
    }
  );
});
