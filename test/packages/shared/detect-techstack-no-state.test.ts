import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/shared/.apm/skills/detect-techstack/scripts/Detect-TechStack.ps1',
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

// Spawns stay single: the cases check the invoking process env and that nothing is written next to the repository.
describe.skipIf(!hasPwsh)('Detect-TechStack.ps1 keeps no state', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'detect-state-')));
    fs.writeFileSync(path.join(dir, 'Cargo.toml'), '[package]\n');
    spawnSync('git', ['-C', dir, 'init', '-q']);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('reports neither state_dir nor manifest_hash and writes no cache or exclude entry', () => {
    const exclude = path.join(dir, '.git', 'info', 'exclude');
    const before = fs.readFileSync(exclude, 'utf8');
    const state = path.join(dir, 'custom-state');
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-ProjectRoot', dir], {
      encoding: 'utf8',
      env: { ...process.env, DROMOS_STATE_DIR: state },
    });
    expect(r.status).toBe(0);
    const report = JSON.parse(r.stdout);
    expect(report.languages).toEqual(['rust']);
    expect(report).not.toHaveProperty('state_dir');
    expect(report).not.toHaveProperty('manifest_hash');
    expect(fs.existsSync(state)).toBe(false);
    expect(fs.existsSync(path.join(dir, '.git', 'agents'))).toBe(false);
    expect(fs.readFileSync(exclude, 'utf8')).toBe(before);
  });
});
