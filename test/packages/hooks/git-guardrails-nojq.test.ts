import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createGuardFixture } from '../../helpers/git-guardrails-fixture';

describe('git-guardrails hook', () => {
  const fx = createGuardFixture();
  const { git, withFreshRepo, claude, copilot, runRaw, denied, runNoJq, dirty } = fx;

  describe('without jq', () => {
    it('has no jq on the restricted PATH', () => {
      expect(fs.existsSync(path.join(fx.nojq, 'jq'))).toBe(false);
    });
    it.each([
      'git reset --hard',
      'git push --force origin main',
      'git clean -fd',
      "bash -c 'git reset --hard'",
    ])('denies a whole-command %s for Claude and Copilot', (c) => {
      expect(denied(runNoJq(claude(c)))).toBe(true);
      expect(denied(runNoJq(copilot(c)))).toBe(true);
    });
    it('denies the literal payloads from the review', () => {
      expect(
        denied(
          runRaw(
            '{"tool_name":"Bash","tool_input":{"command":"git reset --hard"}}',
            {},
            { ...process.env, PATH: fx.nojq }
          )
        )
      ).toBe(true);
      expect(
        denied(
          runRaw(
            '{"toolName":"bash","toolArgs":"{\\"command\\":\\"git reset --hard\\"}"}',
            {},
            { ...process.env, PATH: fx.nojq }
          )
        )
      ).toBe(true);
    });
    it.each([
      'git status',
      'git push --force origin feature',
      'git commit -m "x; git reset --hard"',
      'ls',
    ])('passes %s', (c) => {
      expect(runNoJq(claude(c)).out).toBe('');
      expect(runNoJq(copilot(c)).out).toBe('');
    });
    it('ignores non-Bash tools', () => {
      expect(
        runNoJq({ tool_name: 'Read', tool_input: { command: 'git reset --hard' }, cwd: fx.repo })
          .out
      ).toBe('');
      expect(
        runNoJq({ toolName: 'view', toolArgs: '{"command":"git reset --hard"}', cwd: fx.repo }).out
      ).toBe('');
    });
    it('decodes JSON escapes in the command', () => {
      expect(denied(runNoJq(claude('echo "a\tb"\ngit reset --hard')))).toBe(true);
      expect(denied(runNoJq(claude('echo \\"\n git reset --hard')))).toBe(true);
    });
    it('does not let a cwd inside the command override the real one', () => {
      withFreshRepo();
      fs.mkdirSync(path.join(fx.repo, '.git', 'agents'));
      fs.writeFileSync(path.join(fx.repo, '.git', 'agents', 'guardrails.off'), '');
      const other = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-cwd-'));
      try {
        expect(
          runNoJq({ tool_name: 'Bash', tool_input: { command: 'git reset --hard' }, cwd: other })
            .out
        ).not.toBe('');
        const p = {
          tool_name: 'Bash',
          tool_input: { command: `echo '"cwd":"${other}"'; git reset --hard` },
          cwd: fx.repo,
        };
        expect(runNoJq(p).out).toBe('');
      } finally {
        fs.rmSync(other, { recursive: true, force: true });
      }
    });
    it('denies heredoc and parser cases', () => {
      for (const c of [
        'bash <<EOF\ngit reset --hard\nEOF',
        'cat <<EOF\n$(git reset --hard)\nEOF',
        'sh <<< "git reset --hard"',
        '(( x<<2 ))\ngit reset --hard',
        "echo $'it\\'s'; git reset --hard",
        'git reset --hard>/dev/null',
        'g""it reset --hard',
      ])
        expect(denied(runNoJq(claude(c)))).toBe(true);
    });
    it('resolves HEAD to the current protected branch', () => {
      withFreshRepo();
      git('checkout', '-q', '-b', 'release/2.0');
      expect(denied(runNoJq(claude('git push -f origin HEAD')))).toBe(true);
      expect(runNoJq(claude('git push origin HEAD')).out).toBe('');
    });
    it('denies a dirty checkout only when dirty', () => {
      withFreshRepo();
      expect(runNoJq(claude('git checkout .')).out).toBe('');
      dirty();
      expect(denied(runNoJq(claude('git checkout .')))).toBe(true);
    });
    it('honours both opt-outs', () => {
      withFreshRepo();
      expect(
        runRaw(
          JSON.stringify(claude('git reset --hard')),
          { GIT_GUARDRAILS_OFF: '1' },
          { ...process.env, PATH: fx.nojq }
        ).out
      ).toBe('');
      fs.mkdirSync(path.join(fx.repo, '.git', 'agents'));
      fs.writeFileSync(path.join(fx.repo, '.git', 'agents', 'guardrails.off'), '');
      expect(runNoJq(claude('git reset --hard')).out).toBe('');
    });
    it('passes malformed input', () => {
      expect(runRaw('', {}, { ...process.env, PATH: fx.nojq })).toEqual({ code: 0, out: '' });
      expect(
        runRaw('{"tool_name":"Bash","tool_input":{"comm', {}, { ...process.env, PATH: fx.nojq })
      ).toEqual({ code: 0, out: '' });
    });
  });
});
