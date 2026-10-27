import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { commandFrom, taskIssues } from './orchestrator-state.helpers';

describe('merged-task check (command read from task-issues.md)', () => {
  let dir: string;
  const git = (...a: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], {
      cwd: dir,
      encoding: 'utf-8',
    });
  const grepArgs = (task: string, range: string) => {
    const cmd = commandFrom(taskIssues, '--grep');
    expect(cmd).toContain('"^Refs #<task>$"');
    expect(cmd).toContain('origin/<integration-branch>');
    const words = cmd
      .replace('git ', '')
      .replace('"^Refs #<task>$"', `"^Refs #${task}$"`)
      .replace('origin/<integration-branch>', range)
      .match(/"[^"]*"|\S+/g)!;
    return words.map((w) => w.replace(/^"|"$/g, ''));
  };
  const find = (task: string, range: string) => git(...grepArgs(task, range)).trim();

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merged-'));
    git('init', '-q', '-b', 'release/1.0');
    git('commit', '-q', '--allow-empty', '-m', 'feat: a (#1)\n\nRefs #7');
    git(
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'feat: c (#1)\n\nsome body\nmore body\n\nRefs #123\nCo-Authored-By: x <x@x>'
    );
    git('update-ref', 'refs/remotes/origin/release/1.0', 'HEAD');
    git('commit', '-q', '--allow-empty', '-m', 'feat: b (#2)\n\nRefs #8');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('finds a Task commit on the remote branch beyond ..HEAD', () => {
    expect(find('7', 'origin/release/1.0')).not.toBe('');
    expect(find('8', 'origin/release/1.0')).toBe('');
    expect(find('8', 'origin/release/1.0..HEAD')).not.toBe('');
    expect(find('7', 'origin/release/1.0..HEAD')).toBe('');
  });

  it('does not match #12 against #123 and finds footers in multi-line bodies', () => {
    expect(find('12', 'origin/release/1.0')).toBe('');
    expect(find('123', 'origin/release/1.0')).not.toBe('');
  });
});
