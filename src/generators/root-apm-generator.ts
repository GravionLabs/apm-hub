import * as fs from 'fs';
import * as path from 'path';

const ROOT_APM_FILE = 'apm.yml';

export function generateRootApm(packagesBaseDir = 'packages'): void {
  const domains = fs
    .readdirSync(packagesBaseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(packagesBaseDir, d.name, 'apm.yml')))
    .map((d) => d.name)
    .sort();

  if (domains.length === 0) {
    console.error('No packages found in packages/');
    process.exit(1);
  }

  const existing = fs.existsSync(ROOT_APM_FILE) ? fs.readFileSync(ROOT_APM_FILE, 'utf8') : '';

  const versionMatch = existing.match(/^version:\s*(.+)$/m);
  const mcpMatch = existing.match(/mcp:\s*\[(.*?)\]/s);

  const version = versionMatch ? versionMatch[1].trim() : '1.0.0';
  const mcpEntries = mcpMatch ? mcpMatch[1].trim() : '';

  const depLines = domains.map((d) => `    - ./${packagesBaseDir}/${d}`).join('\n');

  const output = `name: copilot-hub
version: ${version}
description: >
  Meta-package — installs all copilot-hub packages for repository contributors.
  Use individual packages (e.g. gravion/copilot-hub/packages/angular) in your projects.
author:
  name: Gravion
license: MIT
includes: auto
dependencies:
  apm:
${depLines}
  mcp: [${mcpEntries}]
`;

  fs.writeFileSync(ROOT_APM_FILE, output, 'utf8');
  console.log(`Generated ${ROOT_APM_FILE} with ${domains.length} packages: ${domains.join(', ')}`);
}
