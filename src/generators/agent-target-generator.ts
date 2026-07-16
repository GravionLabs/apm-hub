import * as fs from 'fs';
import * as path from 'path';
import { collectDomains } from './list-generator';

/**
 * Compiles each packages/<domain>/.apm/agents/<name>.agent.md source into the
 * per-platform copies this repo deploys (.github/agents, .opencode/agents,
 * .claude/agents), stripping the fields each platform doesn't understand.
 * The strip rules mirror the ones vendored in GravionLabs/apmw
 * (https://github.com/GravionLabs/apmw) via config/agent-strip-fields.json —
 * update that file, not this one, to change which fields are dropped per
 * platform, and keep apmw's vendored copy in sync manually.
 */

interface DeployTarget {
  platform: string;
  dir: string;
  /** Given the source agent name, returns the output filename. */
  fileName: (name: string) => string;
}

const DEPLOY_TARGETS: DeployTarget[] = [
  { platform: 'copilot', dir: '.github/agents', fileName: (name) => `${name}.agent.md` },
  { platform: 'opencode', dir: '.opencode/agents', fileName: (name) => `${name}.md` },
  { platform: 'claude', dir: '.claude/agents', fileName: (name) => `${name}.md` },
];

type StripFieldsConfig = Record<string, string[]>;

function loadStripFieldsConfig(configPath: string): StripFieldsConfig {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/** Returns [frontmatterStart, frontmatterEnd] line indices (both `---` lines), or null. */
function findFrontmatter(lines: string[]): [number, number] | null {
  if (lines.length < 3 || lines[0].trim() !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return [0, i];
  }
  return null;
}

/**
 * Removes top-level frontmatter keys in `fields` (and their indented nested
 * lines) from `fmLines`. Mirrors the Python `strip_fields` implementation in
 * GravionLabs/apmw's src/apmw/__init__.py line-for-line so both stay
 * behaviorally identical.
 */
function stripFields(fmLines: string[], fields: string[]): string[] {
  const patterns = fields.map((f) => new RegExp(`^${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`));

  const newLines: string[] = [];
  let skipIndent = false;
  let skipIndentLevel = 0;

  for (const line of fmLines) {
    if (skipIndent) {
      if (line.length > 0 && !/^\s/.test(line[0])) {
        skipIndent = false;
      } else if (line.length > 0 && /^\s/.test(line[0])) {
        const indent = line.length - line.trimStart().length;
        if (indent <= skipIndentLevel) {
          skipIndent = false;
        } else {
          continue;
        }
      } else {
        skipIndent = false;
      }
    }

    const matched = patterns.some((pat) => pat.test(line));
    if (matched) {
      skipIndent = true;
      skipIndentLevel = line.length > 0 ? line.length - line.trimStart().length : 0;
      continue;
    }

    newLines.push(line);
  }

  return newLines;
}

/**
 * Mirrors the Python `extract_platform_metadata` in GravionLabs/apmw
 * src/apmw/__init__.py. Locates `metadata:` → `<platform>:` in fmLines,
 * extracts and de-indents the nested content lines.
 */
function extractPlatformMetadata(fmLines: string[], platform: string): string[] {
  const metadataRe = /^metadata\s*:/;
  const platformRe = new RegExp(`^(\\s+)${platform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`);

  let inMetadata = false;
  let platformIndent: number | null = null;
  let contentBaseIndent: number | null = null;
  const result: string[] = [];

  for (const line of fmLines) {
    if (!inMetadata) {
      if (metadataRe.test(line)) inMetadata = true;
      continue;
    }

    if (platformIndent === null) {
      if (!line || !/^\s/.test(line[0])) break;
      const m = platformRe.exec(line);
      if (m) platformIndent = m[1].length;
      continue;
    }

    if (!line || !/^\s/.test(line[0])) break;
    const currentIndent = line.length - line.trimStart().length;
    if (currentIndent <= platformIndent) break;

    if (contentBaseIndent === null) contentBaseIndent = currentIndent;
    result.push(line.slice(contentBaseIndent));
  }

  return result;
}

/**
 * Mirrors the Python `inject_metadata_fields` in GravionLabs/apmw
 * src/apmw/__init__.py. Strips top-level fields present in metaLines from
 * fmLines (metadata wins), then appends metaLines.
 */
function injectMetadataFields(fmLines: string[], metaLines: string[]): string[] {
  if (metaLines.length === 0) return fmLines;

  const metaFields: string[] = [];
  for (const line of metaLines) {
    if (line && !/^\s/.test(line[0])) {
      const m = /^(\S+)\s*:/.exec(line);
      if (m) metaFields.push(m[1]);
    }
  }

  const base = metaFields.length > 0 ? stripFields(fmLines, metaFields) : [...fmLines];
  return [...base, ...metaLines];
}

function compileAgentFile(sourcePath: string, fields: string[], platform: string): string {
  const text = fs.readFileSync(sourcePath, 'utf8');
  const lines = text.split('\n');
  const fm = findFrontmatter(lines);
  if (fm === null) return text;

  const [, fmEnd] = fm;
  const fmLines = lines.slice(1, fmEnd);
  const body = lines.slice(fmEnd + 1);

  const newFm = stripFields(fmLines, fields);
  const platformMeta = extractPlatformMetadata(fmLines, platform);
  const finalFm = platformMeta.length > 0 ? injectMetadataFields(newFm, platformMeta) : newFm;
  const result = ['---', ...finalFm, '---', ...body];
  return result.join('\n');
}

export function generateAgentTargets(
  packagesBaseDir = 'packages',
  outputBaseDir = '.',
  configPath = 'config/agent-strip-fields.json'
): void {
  const stripFieldsConfig = loadStripFieldsConfig(configPath);
  const domains = collectDomains(packagesBaseDir);

  for (const domain of domains) {
    const agentsDir = path.join(packagesBaseDir, domain, '.apm', 'agents');
    if (!fs.existsSync(agentsDir)) continue;

    const files = fs
      .readdirSync(agentsDir, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith('.agent.md'))
      .map((f) => f.name)
      .sort();

    for (const fileName of files) {
      const name = fileName.slice(0, -'.agent.md'.length);
      const sourcePath = path.join(agentsDir, fileName);

      for (const target of DEPLOY_TARGETS) {
        const fields = stripFieldsConfig[target.platform] ?? [];
        const compiled = compileAgentFile(sourcePath, fields, target.platform);

        const outDir = path.join(outputBaseDir, target.dir);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        const outPath = path.join(outDir, target.fileName(name));
        fs.writeFileSync(outPath, compiled, 'utf8');
        console.log(`Successfully generated ${outPath}`);
      }
    }
  }
}
