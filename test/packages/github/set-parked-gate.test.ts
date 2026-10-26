import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Fixture, json, makeRepo, plantLease, readLeases, run } from './worktree-test-helpers';

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

describe.skipIf(!hasPwsh)('Set-ParkedGate.ps1', () => {
  let f: Fixture;
  let bin: string;
  let log: string;
  beforeEach(() => {
    f = makeRepo();
    bin = path.join(f.root, 'bin');
    log = path.join(f.root, 'gh.log');
    fs.mkdirSync(bin);
    fs.writeFileSync(
      path.join(bin, 'gh'),
      `#!/bin/sh
echo "$*" >> "${log}"
if [ "$1 $2" = "issue comment" ]; then
  while [ $# -gt 0 ]; do [ "$1" = "--body-file" ] && cat "$2" > "${log}.body.$(date +%s%N)"; shift; done
fi
if [ "$1 $2" = "issue view" ]; then
  [ -f "${log}.body.last" ] && cat "${log}.body.last"
fi
[ -n "$GH_FAIL" ] && exit 1
exit 0
`,
      { mode: 0o755 }
    );
  });
  afterEach(() => fs.rmSync(f.root, { recursive: true, force: true }));

  const env = (extra: Record<string, string> = {}) => ({
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    ...extra,
  });
  const park = (args: string[], extra: Record<string, string> = {}) =>
    run('Set-ParkedGate.ps1', ['-Issue', '579', ...args], f.repo, env(extra));
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : []);
  const bodies = () =>
    fs
      .readdirSync(f.root)
      .filter((n) => n.startsWith('gh.log.body.') && n !== 'gh.log.body.last')
      .map((n) => fs.readFileSync(path.join(f.root, n), 'utf8'));

  it('labels, comments, writes the loop line, frees the lease and keeps the worktree', () => {
    plantLease(f.state, { path: f.repo, issue: 1 });
    const wt = path.join(f.repo, '.worktrees', '579');
    expect(
      run('Enter-Checkout.ps1', ['-Issue', '579', '-Branch', 'feat/579', '-Base', 'main'], f.repo)
        .status
    ).toBe(0);
    const r = park(['-Question', 'Which store?', '-Option', 'sqlite|files', '-Loop', '12']);
    expect(r.status).toBe(0);
    expect(json(r)).toMatchObject({
      parked: true,
      label: 'ok',
      comment: 'ok',
      ledger: 'ok',
      checkout: wt,
    });
    expect(calls()[0]).toBe('issue edit 579 --add-label needs-decision');
    const [body] = bodies();
    expect(body.split('\n')[0]).toBe('<!-- apm-hub:parked-gate -->');
    expect(body).toContain('Which store?');
    expect(body).toContain('- sqlite\n- files\n\nCheckout');
    expect(body).toContain(`Checkout kept: ${wt}`);
    expect(body).toContain('/ruling <option>');
    const ledger = fs.readFileSync(path.join(f.state, 'loop-12', 'progress.md'), 'utf8');
    expect(ledger).toContain('Loop: PBI #579 parked — Which store?');
    expect(fs.existsSync(wt)).toBe(true);
    expect(readLeases(f.state).map((l) => l.issue)).toEqual([1]);
  });

  it('posts no second comment when the newest one has the marker and the question', () => {
    expect(json(park(['-Question', 'Q1?'])).comment).toBe('ok');
    fs.copyFileSync(
      path.join(f.root, fs.readdirSync(f.root).find((n) => n.startsWith('gh.log.body.'))!),
      `${log}.body.last`
    );
    expect(json(park(['-Question', 'Q1?'])).comment).toBe('exists');
    expect(calls().filter((c) => c.startsWith('issue comment'))).toHaveLength(1);
    expect(json(park(['-Question', 'Q2?'])).comment).toBe('ok');
  });

  it('strips control characters from the question', () => {
    park(['-Question', 'a\u0007b\u001b[31m c']);
    expect(bodies()[0]).not.toMatch(/[\u0007\u001b]/);
  });

  it('a failing gh is reported and the lease is still freed', () => {
    plantLease(f.state, { path: f.repo, issue: 1 });
    plantLease(f.state, { path: path.join(f.root, 'x'), issue: 579 });
    const r = park(['-Question', 'Q?'], { GH_FAIL: '1' });
    expect(r.status).toBe(0);
    expect(json(r)).toMatchObject({ parked: true, label: 'failed', comment: 'failed' });
    expect(readLeases(f.state).map((l) => l.issue)).toEqual([1]);
  });

  it('rejects an invalid issue', () => {
    const r = run('Set-ParkedGate.ps1', ['-Issue', 'x', '-Question', 'Q'], f.repo, env());
    expect(r.status).not.toBe(0);
  });

  it('posts the attention payload to DROMOS_URL on loopback, none without it', async () => {
    const got: string[] = [];
    const srv = http.createServer((req, res) => {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => {
        got.push(`${req.url} ${b}`);
        res.end('ok');
      });
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    const port = (srv.address() as { port: number }).port;
    const spawnAsync = (extra: Record<string, string>) =>
      new Promise<void>((resolve) => {
        const c = require('child_process').spawn(
          'pwsh',
          [
            '-NoProfile',
            '-File',
            path.join(
              __dirname,
              '../../../packages/github/.apm/skills/github-issue/scripts/Set-ParkedGate.ps1'
            ),
            '-Issue',
            '579',
            '-Question',
            'Q?',
            '-Option',
            'a',
          ],
          { cwd: f.repo, env: { ...process.env, ...env(extra), GIT_CONFIG_GLOBAL: os.devNull } }
        );
        c.on('close', () => resolve());
      });
    await spawnAsync({});
    expect(got).toEqual([]);
    await spawnAsync({ DROMOS_URL: `http://127.0.0.1:${port}` });
    srv.close();
    expect(got).toHaveLength(1);
    const [url, body] = [got[0].split(' ')[0], got[0].slice(got[0].indexOf(' ') + 1)];
    expect(url).toBe('/ingest');
    expect(JSON.parse(body)).toMatchObject({
      type: 'attention',
      source: 'apm-hub/parked-gate',
      issue: 579,
      data: { kind: 'GATE', question: 'Q?', options: ['a'] },
    });
  }, 60000);

  it('does not post to a non-loopback http URL', () => {
    const r = park(['-Question', 'Q?'], { DROMOS_URL: 'http://example.invalid:1' });
    expect(json(r).parked).toBe(true);
  });
});
