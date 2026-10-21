import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const SKILL_DIRS = ['.claude/skills', '.opencode/skills', '.agents/skills', '.github/skills', '~/.claude/skills', '~/.agents/skills', '~/.config/opencode/skills'];

describe.each(['orchestrator', 'pbi-runner'])('%s OpenCode bash allowlist', (agent) => {
  const text = read(`packages/agents/.apm/agents/${agent}.agent.md`);
  it.each(['Enter-Checkout.ps1', 'Exit-Checkout.ps1'])('allows %s for every skills dir, like Add-LedgerLine.ps1', (script) => {
    for (const dir of SKILL_DIRS) {
      expect(text).toContain(`"pwsh ${dir}/github-issue/scripts/${script} *": allow`);
      expect(text).toContain(`"pwsh ${dir}/github-issue/scripts/Add-LedgerLine.ps1 *": allow`);
    }
  });
});

describe('isolation: worktree is gone', () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel, out);
      else if (/\.(md|ya?ml|ps1|ts|json)$/.test(e.name)) out.push(rel);
    }
    return out;
  };
  const hits = [...walk('packages'), ...walk('docs')].filter((f) => read(f).includes('isolation: worktree'));

  it('is not referenced in any package file', () => {
    expect(hits.filter((f) => f.startsWith('packages/'))).toEqual([]);
  });

  it('survives only as the one explanatory sentence in docs/working-mode.md', () => {
    expect(hits).toEqual(['docs/working-mode.md']);
    expect(read('docs/working-mode.md')).toContain("`.claude/worktrees/` is Claude Code's own location for manual `claude --worktree <name>` sessions");
  });

  it('implementer.agent.md has no parallel-worktree line', () => {
    expect(read('packages/agents/.apm/agents/implementer.agent.md')).not.toMatch(/worktree/i);
  });
});

describe('docs and references name the scripts', () => {
  it.each(['loop-mode.md', 'pbi-pipeline.md'])('%s names Enter-Checkout.ps1 and Exit-Checkout.ps1', (f) => {
    const text = read(`packages/github/.apm/skills/github-issue/references/${f}`);
    expect(text).toContain('Enter-Checkout.ps1 -Issue <pbi> -Branch <branch> -Base <integration branch>');
    expect(text).toContain('Exit-Checkout.ps1 -Issue <pbi>');
  });

  it('working-mode.md describes the convention and warns about git clean -ffdx once', () => {
    const text = read('docs/working-mode.md');
    expect(text).toContain('.worktrees/<nr>');
    expect(text).toContain('Enter-Checkout.ps1');
    expect(text.match(/git clean -ffdx/g)).toHaveLength(1);
  });

  it('orchestrator.md states the new known limit', () => {
    const text = read('docs/orchestrator.md');
    expect(text).toContain('a busy checkout gets a worktree');
    expect(text).not.toContain('use one worktree per run');
  });

  it('CONTRIBUTING.md lists the public surface', () => {
    const text = read('CONTRIBUTING.md');
    expect(text).toContain('.worktrees/<nr>');
    expect(text).toContain('<state>/leases/');
  });

  it('ROADMAP.md lists #442 in 2.5.0', () => {
    const roadmap = read('ROADMAP.md');
    const section = roadmap.slice(roadmap.indexOf('## 2.5.0'));
    expect(section).toContain('| #442 |');
  });

  it('AGENTS.md github row names the new scripts', () => {
    const row = read('AGENTS.md').split('\n').find((l) => l.startsWith('| `github` |'))!;
    for (const s of ['New-Worktree.ps1', 'Remove-Worktree.ps1', 'Enter-Checkout.ps1', 'Exit-Checkout.ps1']) expect(row).toContain(s);
  });
});

describe('verify-project and apm-install wording', () => {
  it('verify-project runs Enable-Worktrees.ps1 -Check and reports the drift as the first error', () => {
    const text = read('packages/delivery/.apm/skills/verify-project/SKILL.md');
    expect(text).toContain('Enable-Worktrees.ps1 -Check');
    expect(text).toMatch(/drift JSON as the first error/);
  });

  it('apm-install runs the apply mode and lists the changed files', () => {
    const text = read('packages/delivery/.apm/skills/apm-install/SKILL.md');
    expect(text).toContain('Enable-Worktrees.ps1');
    expect(text).toContain('apply mode');
    expect(text).toContain('changed files');
    expect(read('packages/delivery/.apm/skills/apm-install/scripts/Install-HubPackages.ps1')).toContain('Enable-Worktrees.ps1');
  });

  it('the queue skill names the lease scripts', () => {
    const text = read('packages/delivery/.apm/skills/queue/SKILL.md');
    expect(text).toContain('Enter-Checkout.ps1');
    expect(text).toContain('Exit-Checkout.ps1');
  });
});
