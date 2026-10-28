import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const script = path.join(repoRoot, 'scripts/Invoke-ScriptAnalysis.ps1');

const hasPwsh = spawnSync('sh', ['-c', 'command -v pwsh'], { encoding: 'utf8' }).status === 0;
const hasAnalyzer =
  hasPwsh &&
  spawnSync('pwsh', [
    '-NoProfile',
    '-Command',
    'if (Get-Module -ListAvailable PSScriptAnalyzer) { exit 0 } exit 1',
  ]).status === 0;

// Fixture root with the repository settings and one script under packages/.
function fixture(content: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-'));
  fs.copyFileSync(
    path.join(repoRoot, 'PSScriptAnalyzerSettings.psd1'),
    path.join(root, 'PSScriptAnalyzerSettings.psd1'),
  );
  fs.mkdirSync(path.join(root, 'packages'));
  fs.writeFileSync(path.join(root, 'packages', 'sample.ps1'), content);
  return root;
}

function run(root: string) {
  return spawnSync('pwsh', ['-NoProfile', '-File', script, '-Root', root], { encoding: 'utf8' });
}

describe.skipIf(!hasAnalyzer)('Invoke-ScriptAnalysis.ps1', () => {
  it('exits 0 on a clean fixture', () => {
    const result = run(fixture('Get-ChildItem -Path . | Out-Null\n'));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no findings');
  });

  it('exits 1 on a fixture with a violation and prints file, line and rule', () => {
    const result = run(fixture("$unused = 1\nInvoke-Expression 'Get-Date'\n"));
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('sample.ps1:2');
    expect(result.stdout).toContain('PSAvoidUsingInvokeExpression');
  });

  it('does not flag rules excluded in the settings file', () => {
    const result = run(fixture("Write-Host 'hi'\n"));
    expect(result.status).toBe(0);
  });
});

describe('lint:ps wiring', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'));

  it('lint:ps calls the script and check includes it', () => {
    expect(pkg.scripts['lint:ps']).toBe('pwsh scripts/Invoke-ScriptAnalysis.ps1');
    expect(pkg.scripts.check).toContain('pnpm run lint:ps');
  });
});
