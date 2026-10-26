import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'yaml';

const root = path.resolve(__dirname, '../../..');
const rel = 'packages/github/.apm/skills/github-release/templates/release-branch.yml';
const wf = parse(fs.readFileSync(path.join(root, rel), 'utf-8'));
const run = (wf.jobs['release-pr'].steps as { id?: string; run?: string }[]).find(
  (s) => s.id === 'in-release'
)!.run!;

// Fake `gh` that honours --jq (through real jq). Pushed commit: PR 7 (merged, base release/next), PR 8 (not merged),
// PR 9 (merged, base main). Behaviour comes from env: CLOSING, BODY, COMMIT, STATUS_<issue>, NO_OPTION, FAIL.
const FAKE_GH = `#!/usr/bin/env bash
args=("$@"); jqf=""
for ((i = 0; i < \${#args[@]}; i++)); do [ "\${args[i]}" = "--jq" ] && jqf="\${args[i+1]}"; done
out() { if [ -n "$jqf" ]; then jq -r "$jqf"; else cat; fi; }
all="$*"
echo "$all" | head -1 >> "$GH_CALLS"
case "$all" in
  *"/commits/"*"/pulls"*)
    [ "$FAIL" = list ] && exit 1
    echo '[{"number":7,"merged_at":"t","base":{"ref":"release/next"}},{"number":8,"merged_at":null,"base":{"ref":"release/next"}},{"number":9,"merged_at":"t","base":{"ref":"main"}}]' | out ;;
  *"pulls/7/commits"*) jq -n --arg m "$COMMIT" '[{commit:{message:$m}}]' | out ;;
  *"pulls/7"*) jq -n --arg b "$BODY" '{body:$b}' | out ;;
  *closingIssuesReferences*)
    [ "$FAIL" = closing ] && exit 1
    jq -n --argjson n "\${CLOSING:-[]}" '{data:{repository:{pullRequest:{closingIssuesReferences:{nodes:($n|map({number:.}))}}}}}' | out ;;
  *updateProjectV2ItemFieldValue*)
    [ "$FAIL" = mutation ] && exit 1
    echo "MUTATION $(tr '\\n' ' ' <<<"$all")" >> "$GH_LOG"; echo '{}' ;;
  *projectItems*)
    [ "$FAIL" = items ] && exit 1
    [ "$FAIL" = scope ] && { echo "gh: Resource not accessible by personal access token" >&2; exit 1; }
    issue=$(grep -oE 'issue=[0-9]+' <<<"$all" | head -1 | cut -d= -f2)
    [ -n "$SCOPE_ISSUE" ] && [ "$issue" = "$SCOPE_ISSUE" ] && { echo "gh: Resource not accessible by personal access token" >&2; exit 1; }
    var="STATUS_$issue"; status="\${!var-__none}"
    opts='[{"id":"o1","name":"Todo"},{"id":"o2","name":"In release"}]'
    [ -n "$NO_OPTION" ] && opts='[{"id":"o1","name":"Todo"}]'
    if [ "$status" = __none ]; then nodes='[]'; else
      nodes=$(jq -n --arg i "i$issue" --arg s "$status" --argjson o "$opts" \\
        '[{id:$i,project:{id:"p1",number:1,field:{id:"f1",options:$o}},fieldValueByName:{name:$s}}]')
    fi
    jq -n --argjson n "$nodes" '{data:{repository:{issue:{projectItems:{nodes:$n}}}}}' | out ;;
esac
`;

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function runStep(env: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'in-release-'));
  dirs.push(dir);
  const log = path.join(dir, 'log');
  const calls = path.join(dir, 'calls');
  const output = path.join(dir, 'output');
  fs.writeFileSync(path.join(dir, 'gh'), FAKE_GH, { mode: 0o755 });
  const r = spawnSync('bash', ['-c', run], {
    encoding: 'utf-8',
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      GH_LOG: log,
      GH_CALLS: calls,
      GITHUB_OUTPUT: output,
      GH_TOKEN: 't',
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_SHA: 'abc',
      GITHUB_REF_NAME: 'release/next',
      ...env,
    },
  });
  const lines = (f: string) =>
    fs.existsSync(f) ? fs.readFileSync(f, 'utf-8').trim().split('\n') : [];
  const issues = lines(output)
    .filter((l) => l.startsWith('issues='))
    .map((l) => l.slice('issues='.length));
  return { ...r, mutations: lines(log), calls: lines(calls), issues };
}

const items = (r: ReturnType<typeof runStep>) =>
  r.mutations.map((m) => /item=(i\d+)/.exec(m)![1]).sort();

describe('In release status step behavior (#489)', () => {
  it('warns and exits 0 without a token, touching nothing', () => {
    const r = runStep({ GH_TOKEN: '' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/::warning::no token with scope project/);
    expect(r.calls).toEqual([]);
    expect(r.issues).toEqual([]);
  });

  it('writes issues= with only the issues set to In release (#626)', () => {
    const r = runStep({
      CLOSING: '[11, 12, 14]',
      STATUS_11: 'In progress',
      STATUS_12: 'Done',
      STATUS_14: 'In release',
    });
    expect(r.issues).toEqual(['11']);
    const none = runStep({ CLOSING: '[12]', STATUS_12: 'Done' });
    expect(none.issues).toEqual(['']);
  });

  it('writes an empty issues= when the project scope fails on the first issue (#626)', () => {
    const r = runStep({ CLOSING: '[11]', STATUS_11: 'Todo', FAIL: 'scope' });
    expect(r.issues).toEqual(['']);
  });

  it('keeps the issues already set when a later issue hits the project-scope failure (#626)', () => {
    const r = runStep({
      CLOSING: '[11, 12]',
      STATUS_11: 'Todo',
      STATUS_12: 'Todo',
      SCOPE_ISSUE: '12',
    });
    expect(r.status).toBe(0);
    expect(items(r)).toEqual(['i11']);
    expect(r.issues).toEqual(['11']);
  });

  it('sets closed, keyword-listed and Refs-only issues, skips Done and word-glued keywords', () => {
    const r = runStep({
      CLOSING: '[11]',
      COMMIT: 'feat: x\n\nRefs #12, #14 and #123',
      BODY: 'Closes #13\nprefix #99 fixes #15',
      STATUS_11: 'In progress',
      STATUS_12: 'Done',
      STATUS_14: 'Todo',
      STATUS_15: 'In release',
    });
    expect(r.status).toBe(0);
    expect(items(r)).toEqual(['i11', 'i14']);
    expect(r.mutations.every((m) => /option=o2/.test(m))).toBe(true);
    expect(r.stdout).toMatch(/#12 in project 1 is already 'Done'/);
    expect(r.stdout).toMatch(/#15 in project 1 is already 'In release'/);
    expect(r.stdout).toMatch(/#13 has no project item/);
    expect(r.stdout).toMatch(/#123 has no project item/);
    expect(r.calls.some((c) => /issue=99\b/.test(c))).toBe(false);
  });

  it('only looks at merged PRs whose base is the pushed branch', () => {
    const r = runStep({ CLOSING: '[11]', STATUS_11: 'Todo' });
    expect(r.calls.some((c) => /pulls\/7/.test(c))).toBe(true);
    expect(r.calls.some((c) => /pulls\/[89]/.test(c))).toBe(false);
    const other = runStep({ CLOSING: '[11]', STATUS_11: 'Todo', GITHUB_REF_NAME: 'release/1.2' });
    expect(other.calls.some((c) => /pulls\/\d/.test(c))).toBe(false);
    expect(other.mutations).toEqual([]);
  });

  it('sets a Refs-only issue when the PR closes nothing (release/next)', () => {
    const r = runStep({ CLOSING: '[]', COMMIT: 'Refs #12', STATUS_12: 'Todo' });
    expect(items(r)).toEqual(['i12']);
  });

  it('warns and skips when the project has no In release option', () => {
    const r = runStep({ CLOSING: '[11]', STATUS_11: 'Todo', NO_OPTION: '1' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/::warning::project 1 has no Status option 'In release'; #11 skipped/);
    expect(r.mutations).toEqual([]);
  });

  describe('failures never fail the step', () => {
    it.each([
      ['list', /::warning::cannot list pull requests/],
      ['items', /::warning::cannot read project items of #11/],
      ['mutation', /::warning::could not set Status of #11/],
    ])('%s', (fail, warning) => {
      const r = runStep({ CLOSING: '[11]', STATUS_11: 'Todo', FAIL: fail });
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(warning);
    });

    it('a token without scope project warns once, keeps the gh error and stops instead of one warning per issue', () => {
      const r = runStep({
        CLOSING: '[11, 12]',
        STATUS_11: 'Todo',
        STATUS_12: 'Todo',
        FAIL: 'scope',
      });
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(
        /::warning::token cannot access the project \(classic PAT with scope project needed; fine-grained tokens cannot access user-owned projects\)/
      );
      expect(r.stderr).toMatch(/Resource not accessible by personal access token/);
      expect(r.stdout).not.toMatch(/cannot read project items/);
      expect(r.calls.filter((c) => /-F issue=/.test(c))).toHaveLength(1);
      expect(r.mutations).toEqual([]);
    });

    it('closing-reference failure still handles keyword-named issues', () => {
      const r = runStep({ FAIL: 'closing', COMMIT: 'Refs #12', STATUS_12: 'Todo' });
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/::warning::cannot read issues closed by PR #7/);
      expect(items(r)).toEqual(['i12']);
    });
  });
});
