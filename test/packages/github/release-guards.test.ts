import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// #252: a released release branch (its `v<x.y>.0` tag exists, or it was continued past its merge) is never
// finished or picked again. The snippets under test are the ones the skill text carries, extracted verbatim.
const root = path.resolve(__dirname, '../../..');
const skill = fs.readFileSync(path.join(root, 'packages/github/.apm/skills/github-release/SKILL.md'), 'utf-8');
const reference = fs.readFileSync(
  path.join(root, 'packages/github/.apm/skills/github-issue/references/release-branches.md'),
  'utf-8',
);

const snippet = (text: string, start: RegExp): string => {
  const m = text.match(start);
  if (!m) throw new Error(`snippet not found: ${start}`);
  return m[1];
};
const resolver = snippet(reference, /`(h=\$\(git ls-remote --heads origin 'release\/\*'[^`]*)`/);
const releasedCheck = snippet(skill, /`(for t in \$\(git tag -l 'v\*'\);[^`]*)`/);
const tagCheck = snippet(skill, /`(git ls-remote --tags origin "refs\/tags\/v<x\.y>\.0")`/);
const mergedCheck = snippet(skill, /`(git log --merges --first-parent origin\/<default> --format=%P[^`]*)`/).replace(
  '<default>',
  'main',
);

const hermetic = (home: string): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_') || k === 'XDG_CONFIG_HOME') delete env[k];
  return { ...env, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
};

describe('release guards (#252)', () => {
  let tmp: string;
  let work: string; // the history, source of every origin ref
  let origin: string; // bare remote
  let clone: string; // working clone with `origin`
  let env: NodeJS.ProcessEnv;

  const git = (cwd: string, ...args: string[]) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', env });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    return r.stdout.trim();
  };
  const commit = (cwd: string, name: string) => {
    fs.writeFileSync(path.join(cwd, `${name}.txt`), name);
    git(cwd, 'add', `${name}.txt`);
    git(cwd, 'commit', '-q', '-m', name);
  };
  const bash = (cwd: string, script: string) => {
    const r = spawnSync('bash', ['-c', script], { cwd, encoding: 'utf8', env });
    expect(r.stderr).toBe('');
    return { out: r.stdout.trim(), status: r.status };
  };
  const dropRef = (ref: string) => git(origin, 'update-ref', '-d', ref);
  // origin heads are reset from `work` before every resolver case, so the cases are independent
  const resetHeads = () => git(origin, 'fetch', '-q', work, '+refs/heads/*:refs/heads/*');

  // History: main A ─ M1 (merge of release/2.1 = B, tag v2.1.0) ─ H (hotfix, tag v2.1.1) ─ M2 (merge of release/next = D, tag v2.3.0)
  //          release/2.2 = C from M1, release/legacy = A, release/2.1 continued with E, release/next continued with F,
  //          fresh = G from M2 (cut after the release), release/9.0 = A with tag v9.0.0 (released, sorts above 2.2)
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-guards-'));
    env = hermetic(tmp);
    work = path.join(tmp, 'work');
    fs.mkdirSync(work);
    git(work, 'init', '-q', '-b', 'main');
    commit(work, 'A');
    git(work, 'checkout', '-q', '-b', 'release/2.1');
    commit(work, 'B');
    git(work, 'checkout', '-q', 'main');
    git(work, 'merge', '-q', '--no-ff', '-m', 'release: 2.1', 'release/2.1');
    git(work, 'tag', '-a', '-m', 'v2.1.0', 'v2.1.0');
    git(work, 'checkout', '-q', '-b', 'release/2.2');
    commit(work, 'C');
    git(work, 'checkout', '-q', '-b', 'release/next', 'main');
    commit(work, 'D');
    git(work, 'branch', '-q', 'release/legacy', 'main~1');
    git(work, 'branch', '-q', 'release/9.0', 'main~1'); // released line sorting above 2.2, tag v9.0.0 on origin
    git(work, 'tag', 'v9.0.0', 'main~1');
    git(work, 'checkout', '-q', 'main');
    commit(work, 'H');
    git(work, 'tag', 'v2.1.1');
    git(work, 'checkout', '-q', 'release/2.1');
    commit(work, 'E');
    git(work, 'checkout', '-q', 'main');
    git(work, 'merge', '-q', '--no-ff', '-m', 'release: release/next', 'release/next');
    git(work, 'tag', '-a', '-m', 'v2.3.0', 'v2.3.0');
    git(work, 'checkout', '-q', '-b', 'fresh');
    commit(work, 'G');
    git(work, 'checkout', '-q', 'release/next');
    commit(work, 'F');
    git(work, 'checkout', '-q', 'main');
    origin = path.join(tmp, 'origin.git');
    git(tmp, 'clone', '-q', '--bare', work, origin);
    clone = path.join(tmp, 'clone');
    git(tmp, 'clone', '-q', origin, clone);
  });
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  describe('finish: already released check', () => {
    it('names the tag when the branch was continued past its merge', () => {
      git(clone, 'checkout', '-q', 'release/2.1');
      expect(bash(clone, releasedCheck).out).toBe('v2.1.0');
    });

    it('names the tag for release/next continued after its merge (the rolling branch has no <x.y> tag to check)', () => {
      git(clone, 'checkout', '-q', 'release/next');
      expect(bash(clone, releasedCheck).out).toBe('v2.3.0');
    });

    it('is silent for a branch cut from main after the release (hotfix tags on plain commits are ignored)', () => {
      git(clone, 'checkout', '-q', 'fresh');
      expect(bash(clone, releasedCheck).out).toBe('');
    });

    it('is silent for release/2.2, which was cut after v2.1.0', () => {
      git(clone, 'checkout', '-q', 'release/2.2');
      expect(bash(clone, releasedCheck).out).toBe('');
    });

    it('is silent for a branch whose head carries a lightweight tag on a plain commit (release/legacy = A)', () => {
      git(clone, 'checkout', '-q', 'release/legacy');
      expect(bash(clone, releasedCheck).out).toBe('');
    });
  });

  describe('finish: merged tip (second parent of a merge on <default>)', () => {
    it('succeeds for the unchanged merged tip of release/2.1 (v2.1.0^2 = B)', () => {
      git(clone, 'checkout', '-q', 'v2.1.0^2');
      expect(bash(clone, mergedCheck).status).toBe(0);
    });

    it('fails for a continued branch and for an unreleased one', () => {
      git(clone, 'checkout', '-q', 'release/next');
      expect(bash(clone, mergedCheck).status).toBe(1);
      git(clone, 'checkout', '-q', 'release/2.2');
      expect(bash(clone, mergedCheck).status).toBe(1);
    });
  });

  describe('finish and cut: v<x.y>.0 tag on origin', () => {
    const forLine = (xy: string) => bash(clone, tagCheck.replace('<x.y>', xy));

    it('prints a line for an annotated .0 tag (2.1) and a lightweight one (9.0)', () => {
      expect(forLine('2.1').out).toContain('refs/tags/v2.1.0');
      expect(forLine('9.0').out).toContain('refs/tags/v9.0.0');
    });

    it('prints nothing for an unreleased line (2.2) and does not match the patch tag v2.1.1', () => {
      expect(forLine('2.2').out).toBe('');
      expect(forLine('2.1.1').out).toBe('');
    });
  });

  describe('resolver step 4', () => {
    beforeEach(resetHeads);

    it('prefers release/next when it exists', () => {
      const r = bash(clone, resolver);
      expect(r.status).toBe(0);
      expect(r.out).toBe('release/next');
    });

    it('skips release/<x.y> lines whose v<x.y>.0 tag is on origin (even the highest) and legacy names', () => {
      dropRef('refs/heads/release/next');
      const r = bash(clone, resolver);
      expect(r.status).toBe(0);
      expect(r.out).toBe('release/2.2');
    });

    it('prints nothing when every release/<x.y> is released', () => {
      dropRef('refs/heads/release/next');
      dropRef('refs/heads/release/2.2');
      expect(bash(clone, resolver).out).toBe('');
    });

    it('prints nothing without release branches', () => {
      for (const b of ['next', '2.1', '2.2', '9.0', 'legacy']) dropRef(`refs/heads/release/${b}`);
      dropRef('refs/heads/fresh');
      expect(bash(clone, resolver).out).toBe('');
    });
  });
});
