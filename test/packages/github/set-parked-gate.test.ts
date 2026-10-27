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
    expect(body).toContain('/ruling <option or free text>');
    expect(body).toMatch(/newest comment after this one[^\n]*push access/);
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

  it('quotes the question and neutralizes @mentions, so the comment neither pings nor starts a line with /ruling', () => {
    park(['-Question', '/ruling yes @octocat', '-Option', '@team/x|b']);
    const body = bodies()[0];
    expect(body).toContain('> /ruling yes @\u200Boctocat');
    expect(body).toContain('- @\u200Bteam/x\n- b');
    expect(body.split('\n').filter((l) => l.startsWith('/ruling'))).toEqual([]);
    expect(body).not.toMatch(/@[A-Za-z0-9]/);
  });

  it('recognises its own neutralized comment as already posted', () => {
    expect(json(park(['-Question', 'Ask @octocat?'])).comment).toBe('ok');
    fs.copyFileSync(
      path.join(f.root, fs.readdirSync(f.root).find((n) => n.startsWith('gh.log.body.'))!),
      `${log}.body.last`
    );
    expect(json(park(['-Question', 'Ask @octocat?'])).comment).toBe('exists');
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
    // the script waits at most 500 ms: a cold pwsh HttpClient on a loaded runner can miss that once, so retry the post
    for (let i = 0; i < 3 && got.length === 0; i++)
      await spawnAsync({ DROMOS_URL: `http://127.0.0.1:${port}` });
    srv.close();
    expect(got.length).toBeGreaterThanOrEqual(1);
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

  it('sends nothing to a reachable server for credentials in the URL or an http host off the loopback list', async () => {
    const got: string[] = [];
    const srv = http.createServer((req, res) => {
      got.push(`${req.url}`);
      res.end('ok');
    });
    await new Promise<void>((r) => srv.listen(0, '0.0.0.0', r));
    const port = (srv.address() as { port: number }).port;
    // 0.0.0.0 reaches this server (checked first), but it is not on the http allow list (localhost, 127.0.0.1, [::1])
    const reachable = await new Promise<boolean>((resolve) =>
      http
        .get(`http://0.0.0.0:${port}/probe`, (res) => (res.resume(), resolve(true)))
        .on('error', () => resolve(false))
    );
    const spawnAsync = (url: string) =>
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
          ],
          {
            cwd: f.repo,
            env: { ...process.env, ...env({ DROMOS_URL: url }), GIT_CONFIG_GLOBAL: os.devNull },
          }
        );
        c.on('close', () => resolve());
      });
    await spawnAsync(`http://user:secret@127.0.0.1:${port}`);
    if (reachable) await spawnAsync(`http://0.0.0.0:${port}`);
    srv.close();
    expect(got.filter((u) => u !== '/probe')).toEqual([]);
  }, 60000);
});
