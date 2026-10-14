import * as fs from 'fs';
import * as path from 'path';

const HOOKS_DIR = path.resolve(__dirname, '../../packages/hooks/.apm/hooks');

type Entry = { matcher?: string; hooks: unknown[] };
type Manifest = { hooks: Record<string, Entry[]> };

const isClaude = (event: string) => /^[A-Z]/.test(event);
const isCopilot = (event: string) => /^[a-z]/.test(event);

const manifests = fs
  .readdirSync(HOOKS_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, json: JSON.parse(fs.readFileSync(path.join(HOOKS_DIR, f), 'utf8')) as Manifest }));

const eventsOf = (pick: (e: string) => boolean) =>
  manifests.flatMap((m) => Object.keys(m.json.hooks).filter(pick)).sort();

describe('hook manifests: event set per harness', () => {
  it('finds the hook manifests', () => {
    expect(manifests.length).toBeGreaterThan(0);
  });

  it('Claude Code gets exactly SubagentStop, UserPromptSubmit, PreToolUse', () => {
    expect(eventsOf(isClaude)).toEqual(['PreToolUse', 'SubagentStop', 'UserPromptSubmit']);
  });

  it('Copilot gets exactly subagentStop, postToolUse, preToolUse', () => {
    expect(eventsOf(isCopilot)).toEqual(['postToolUse', 'preToolUse', 'subagentStop']);
  });

  it('PreToolUse uses matcher Bash and has no * entry', () => {
    const entries = manifests.flatMap((m) => m.json.hooks.PreToolUse ?? []);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.map((e) => e.matcher)).toEqual(entries.map(() => 'Bash'));
  });

  // apm 0.33.0 integrates every event of a manifest into every target, so a
  // manifest installed into Claude Code must not carry camelCase (Copilot) events.
  it.each(manifests.map((m) => [m.file, m.json] as const))(
    '%s carries no camelCase event into Claude Code',
    (file, json) => {
      const camel = Object.keys(json.hooks).filter(isCopilot);
      if (file.endsWith('.copilot.json')) return;
      expect(camel).toEqual([]);
    },
  );
});
