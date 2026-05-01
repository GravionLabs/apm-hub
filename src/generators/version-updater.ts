import * as fs from 'fs';
import * as path from 'path';

export function updatePackageVersions(version: string, packagesBaseDir = 'packages'): void {
  const domains = fs
    .readdirSync(packagesBaseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(packagesBaseDir, d.name, 'apm.yml')))
    .map((d) => d.name)
    .sort();

  for (const domain of domains) {
    const apmFile = path.join(packagesBaseDir, domain, 'apm.yml');
    updateVersionInFile(apmFile, version);
  }

  if (fs.existsSync('apm.yml')) {
    updateVersionInFile('apm.yml', version);
  }

  console.log(`Updated version to ${version} in ${domains.length} packages + root apm.yml`);
}

function updateVersionInFile(filePath: string, version: string): void {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(/^version:\s*.+$/m, `version: ${version}`);
  fs.writeFileSync(filePath, updated, 'utf8');
}
