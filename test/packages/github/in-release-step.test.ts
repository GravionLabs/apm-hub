import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'yaml';

const root = path.resolve(__dirname, '../../..');
const rel = 'packages/github/.apm/skills/github-release/templates/release-branch.yml';
const wf = parse(fs.readFileSync(path.join(root, rel), 'utf-8'));
const run = (wf.jobs['release-pr'].steps as { id?: string; run?: string }[]).find((s) => s.id === 'in-release')!.run!;

// Fake `gh`: PR 7 (merged, base release/next) closes #11, its commit says `Refs #12`, its body `Closes #13`.
const FAKE_GH = `#!/usr/bin/env bash
args="$*"
case "$args" in
  *"/commits/"*"/pulls"*) echo 7 ;;
  *"pulls/7/commits"*) printf 'feat: x\\n\\nRefs #12\\n' ;;
  *"pulls/7"*) echo 'Closes #13' ;;
  *closingIssuesReferences*) echo 11 ;;
  *updateProjectV2ItemFieldValue*) echo "MUTATION $(tr '\\n' ' ' <<<"$args")" >> "$GH_LOG"; echo '{}' ;;
  *projectItems*)
    issue=$(grep -oE 'issue=[0-9]+' <<<"$args" | head -1 | cut -d= -f2)
    opts='[{"id":"o1","name":"Todo"},{"id":"o2","name":"In release"}]'
    case "$issue" in
      11) echo '{"id":"i11","project":{"id":"p1","number":1,"field":{"id":"f1","options":'"$opts"'}},"fieldValueByName":{"name":"In progress"}}' ;;
      12) echo '{"id":"i12","project":{"id":"p1","number":1,"field":{"id":"f1","options":'"$opts"'}},"fieldValueByName":{"name":"Done"}}' ;;
      *) ;;
    esac ;;
esac
`;

function runStep(token: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'in-release-'));
  const log = path.join(dir, 'log');
  fs.writeFileSync(path.join(dir, 'gh'), FAKE_GH, { mode: 0o755 });
  const r = spawnSync('bash', ['-c', run], {
    encoding: 'utf-8',
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      GH_LOG: log,
      GH_TOKEN: token,
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_SHA: 'abc',
      GITHUB_REF_NAME: 'release/next',
    },
  });
  const mutations = fs.existsSync(log) ? fs.readFileSync(log, 'utf-8').trim().split('\n') : [];
  return { ...r, mutations };
}

describe('In release status step behavior (#489)', () => {
  it('warns and exits 0 without a token, touching nothing', () => {
    const r = runStep('');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/::warning::no token with scope project/);
    expect(r.mutations).toEqual([]);
  });

  it('sets only the closed issue, skips Done, notices issues without a project item', () => {
    const r = runStep('t');
    expect(r.status).toBe(0);
    expect(r.mutations).toHaveLength(1);
    expect(r.mutations[0]).toMatch(/item=i11/);
    expect(r.mutations[0]).toMatch(/option=o2/);
    expect(r.stdout).toMatch(/#12 in project 1 is already 'Done'/);
    expect(r.stdout).toMatch(/#13 has no project item/);
  });
});
