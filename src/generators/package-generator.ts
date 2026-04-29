import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

export interface PackageAgent {
  source: string;
}

export interface PackageSkill {
  name?: string;
  source: string;
  extend?: string[];
}

export interface PackageInstruction {
  source: string;
}

export interface PackagePrimitives {
  agents?: PackageAgent[];
  skills?: PackageSkill[];
  instructions?: PackageInstruction[];
}

export interface PackageConfig {
  name: string;
  version: string;
  description: string;
  author?: { name: string; email?: string; url?: string };
  license?: string;
  keywords?: string[];
  status: 'draft' | 'production' | 'obsolete';
  primitives?: PackagePrimitives;
  apm?: {
    dependencies?: {
      apm?: string[];
      mcp?: string[];
    };
    tags?: string[];
  };
  copilot?: {
    tags?: string[];
  };
}

interface GeneratorOptions {
  templatesDir?: string;
  packagesDir?: string;
  githubDir?: string;
  verbose?: boolean;
}

export class PackageGenerator {
  private templatesDir: string;
  private packagesDir: string;
  private githubDir: string;
  private verbose: boolean;

  constructor(options: GeneratorOptions = {}) {
    this.templatesDir = options.templatesDir || path.join(process.cwd(), 'templates');
    this.packagesDir = options.packagesDir || path.join(process.cwd(), 'packages');
    this.githubDir = options.githubDir || path.join(process.cwd(), '.github');
    this.verbose = options.verbose ?? false;
  }

  log(msg: string) {
    if (this.verbose) {
      console.log(msg);
    }
  }

  private loadPackages(): Map<string, PackageConfig> {
    const packages = new Map<string, PackageConfig>();

    if (!fs.existsSync(this.templatesDir)) {
      this.log(`Templates directory not found: ${this.templatesDir}`);
      return packages;
    }

    const domains = fs.readdirSync(this.templatesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const domain of domains) {
      const packageYmlPath = path.join(this.templatesDir, domain, 'package.yml');

      if (fs.existsSync(packageYmlPath)) {
        try {
          const content = fs.readFileSync(packageYmlPath, 'utf-8');
          const config = parseYaml(content) as PackageConfig;
          packages.set(domain, config);
          this.log(`Loaded package: ${domain} (status: ${config.status})`);
        } catch (error) {
          console.error(`Error loading ${packageYmlPath}:`, error);
        }
      }
    }

    return packages;
  }

  private filterPackages(
    packages: Map<string, PackageConfig>,
    target: 'hub' | 'apm'
  ): Map<string, PackageConfig> {
    const filtered = new Map<string, PackageConfig>();

    for (const [name, config] of packages) {
      if (target === 'hub') {
        if (config.status === 'production' || config.status === 'draft') {
          filtered.set(name, config);
        }
      } else if (target === 'apm') {
        if (config.status === 'production') {
          filtered.set(name, config);
        }
      }
    }

    return filtered;
  }

  private copyPrimitive(
    domain: string,
    source: string,
    destinationDir: string
  ): string | null {
    const sourceFullPath = path.join(this.templatesDir, source);

    if (!fs.existsSync(sourceFullPath)) {
      console.warn(`Source not found: ${sourceFullPath}`);
      return null;
    }

    const basename = path.basename(sourceFullPath);
    const destination = path.join(destinationDir, basename);

    if (fs.lstatSync(sourceFullPath).isDirectory()) {
      this.recursiveCopy(sourceFullPath, destination);
    } else {
      fs.copyFileSync(sourceFullPath, destination);
    }

    return destination;
  }

  private recursiveCopy(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const files = fs.readdirSync(src, { withFileTypes: true });

    for (const file of files) {
      const srcPath = path.join(src, file.name);
      const destPath = path.join(dest, file.name);

      if (file.isDirectory()) {
        this.recursiveCopy(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private generateCopilotHub(domain: string, config: PackageConfig, packagesDir: string) {
    const hubDir = path.join(packagesDir, domain, '.github');
    fs.mkdirSync(hubDir, { recursive: true });

    if (config.primitives?.agents) {
      const agentsDir = path.join(hubDir, 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });

      for (const agent of config.primitives.agents) {
        this.copyPrimitive(domain, agent.source, agentsDir);
      }
    }

    if (config.primitives?.skills) {
      const skillsDir = path.join(hubDir, 'skills');
      fs.mkdirSync(skillsDir, { recursive: true });

      for (const skill of config.primitives.skills) {
        this.copyPrimitive(domain, skill.source, skillsDir);
      }
    }

    if (config.primitives?.instructions) {
      const instructionsDir = path.join(hubDir, 'instructions');
      fs.mkdirSync(instructionsDir, { recursive: true });

      for (const instruction of config.primitives.instructions) {
        this.copyPrimitive(domain, instruction.source, instructionsDir);
      }
    }

    this.log(`Generated Copilot Hub runtime: ${hubDir}`);
  }

  private generateApm(domain: string, config: PackageConfig, packagesDir: string) {
    const apmDir = path.join(packagesDir, domain, '.apm');
    fs.mkdirSync(apmDir, { recursive: true });

    if (config.primitives?.agents) {
      const agentsDir = path.join(apmDir, 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });

      for (const agent of config.primitives.agents) {
        this.copyPrimitive(domain, agent.source, agentsDir);
      }
    }

    if (config.primitives?.skills) {
      const skillsDir = path.join(apmDir, 'skills');
      fs.mkdirSync(skillsDir, { recursive: true });

      for (const skill of config.primitives.skills) {
        this.copyPrimitive(domain, skill.source, skillsDir);
      }
    }

    if (config.primitives?.instructions) {
      const instructionsDir = path.join(apmDir, 'instructions');
      fs.mkdirSync(instructionsDir, { recursive: true });

      for (const instruction of config.primitives.instructions) {
        this.copyPrimitive(domain, instruction.source, instructionsDir);
      }
    }

    this.log(`Generated APM runtime: ${apmDir}`);
  }

  private generateApmYaml(domain: string, config: PackageConfig, packagesDir: string) {
    const apmYmlPath = path.join(packagesDir, domain, 'apm.yml');

    const apmManifest: any = {
      name: config.name,
      version: config.version,
      description: config.description,
      author: config.author,
      license: config.license,
      keywords: config.keywords,
    };

    if (config.apm?.dependencies) {
      apmManifest.dependencies = config.apm.dependencies;
    }

    const apmYmlContent = this.objectToYaml(apmManifest);
    fs.writeFileSync(apmYmlPath, apmYmlContent, 'utf-8');

    this.log(`Generated apm.yml: ${apmYmlPath}`);
  }

  private objectToYaml(obj: any, indent = 0): string {
    let result = '';
    const indentStr = '  '.repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;

      if (typeof value === 'string') {
        const needsQuotes = value.includes(':') || value.includes('"') || value.includes('\n');
        result += `${indentStr}${key}: ${needsQuotes ? JSON.stringify(value) : value}\n`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        result += `${indentStr}${key}: ${value}\n`;
      } else if (Array.isArray(value)) {
        result += `${indentStr}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'string') {
            result += `${indentStr}  - ${item}\n`;
          } else {
            result += `${indentStr}  - `;
            result += this.objectToYaml(item, indent + 2).trim() + '\n';
          }
        }
      } else if (typeof value === 'object') {
        result += `${indentStr}${key}:\n`;
        result += this.objectToYaml(value, indent + 1);
      }
    }

    return result;
  }

  private generateApmLockfile(domain: string, config: PackageConfig, packagesDir: string) {
    const apmLockPath = path.join(packagesDir, domain, 'apm.lock.yaml');

    const apmLock: any = {
      version: '1.0',
      package: {
        name: config.name,
        version: config.version,
      },
      generated: new Date().toISOString(),
    };

    const apmLockContent = this.objectToYaml(apmLock);
    fs.writeFileSync(apmLockPath, apmLockContent, 'utf-8');

    this.log(`Generated apm.lock.yaml: ${apmLockPath}`);
  }

  public generate() {
    this.log('Starting Package Generation...\n');

    const allPackages = this.loadPackages();
    this.log(`\nLoaded ${allPackages.size} packages\n`);

    const hubPackages = this.filterPackages(allPackages, 'hub');
    const apmPackages = this.filterPackages(allPackages, 'apm');

    this.log(`Hub packages (draft + production): ${hubPackages.size}`);
    this.log(`APM packages (production only): ${apmPackages.size}\n`);

    this.log('Generating Copilot Hub runtimes...');
    for (const [domain, config] of hubPackages) {
      try {
        this.generateCopilotHub(domain, config, this.packagesDir);
      } catch (error) {
        console.error(`Error generating Hub for ${domain}:`, error);
      }
    }

    this.log('\nGenerating APM runtimes...');
    for (const [domain, config] of apmPackages) {
      try {
        this.generateApm(domain, config, this.packagesDir);
        this.generateApmYaml(domain, config, this.packagesDir);
        this.generateApmLockfile(domain, config, this.packagesDir);
      } catch (error) {
        console.error(`Error generating APM for ${domain}:`, error);
      }
    }

    this.log('\nPackage generation complete!');
    return {
      hubPackages: hubPackages.size,
      apmPackages: apmPackages.size,
      obsoletePackages: allPackages.size - hubPackages.size - apmPackages.size,
    };
  }
}

if (require.main === module) {
  const generator = new PackageGenerator({ verbose: true });
  generator.generate();
}

export default PackageGenerator;
