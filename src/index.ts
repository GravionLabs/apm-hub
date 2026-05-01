import { generateTemplateList } from './generators/template-list-generator';
import { updateReadme, updateFileBlock } from './generators/readme-generator';
import { formatAllDocs } from './generators/format-docs-generator';
import { generateSkillList } from './generators/skill-list-generator';
import { generateAgentList } from './generators/agent-list-generator';
import { generateInstructionList } from './generators/instruction-list-generator';
import { updatePackageVersions } from './generators/version-updater';
import { generateRootApm } from './generators/root-apm-generator';

function generateAggregateDocs(version?: string) {
  if (version) {
    updatePackageVersions(version);
  }
  generateTemplateList();
  generateSkillList();
  generateAgentList();
  generateInstructionList();
  updateReadme();
  if (version) {
    updateFileBlock('docs/overview.md', 'version', `Welcome to **copilot-hub** v${version} 👋`);
  }
  formatAllDocs();
}

function main() {
  const args = process.argv.slice(2);

  // Extract optional --version <semver> argument
  let version: string | undefined;
  const versionFlagIndex = args.indexOf('--version');
  if (versionFlagIndex !== -1 && versionFlagIndex + 1 < args.length) {
    version = args[versionFlagIndex + 1];
    args.splice(versionFlagIndex, 2);
  }

  // Default (no args): regenerate aggregate docs
  if (args.length === 0) {
    console.log('Regenerating aggregate docs...');
    generateAggregateDocs(version);
    return;
  }

  const inputPath = args[0];

  // --aggregate: regenerate all aggregate docs (CI use)
  if (inputPath === '--aggregate') {
    console.log('Regenerating all aggregate docs...');
    generateAggregateDocs(version);
    return;
  }

  if (inputPath === '--skill-list') {
    generateSkillList();
    return;
  }

  if (inputPath === '--agent-list') {
    generateAgentList();
    return;
  }

  if (inputPath === '--instruction-list') {
    generateInstructionList();
    return;
  }

  if (inputPath === '--root-apm') {
    generateRootApm();
    return;
  }

  console.error(`Error: Unknown argument: ${inputPath}`);
  process.exit(1);
}

main();
