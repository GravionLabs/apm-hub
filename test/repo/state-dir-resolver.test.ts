import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
/** Every pwsh file that defines Resolve-StateDir (later tasks extend this list). */
const PWSH_FILES = ['scripts/Invoke-HeadlessSmoke.ps1'];

const extract = (rel: string): string => {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^# BEGIN Resolve-StateDir[^\n]*\n[\s\S]*?^# END Resolve-StateDir$/m);
  if (!m) throw new Error(`${rel}: no Resolve-StateDir block between BEGIN/END markers`);
  return m[0];
};

describe('Resolve-StateDir copies', () => {
  it.each(PWSH_FILES)('%s defines the function between markers', (rel) => {
    expect(extract(rel)).toContain('function Resolve-StateDir {');
  });

  it('is byte-identical in every pwsh file', () => {
    const [first, ...rest] = PWSH_FILES.map(extract);
    for (const other of rest) expect(other).toBe(first);
  });

  it('keeps the contract: override, git common dir, error text', () => {
    const block = extract(PWSH_FILES[0]);
    expect(block).toContain('DROMOS_STATE_DIR');
    expect(block).toContain('--git-common-dir');
    expect(block).toContain(
      'No state directory: not inside a git repository (set DROMOS_STATE_DIR)',
    );
  });
});
