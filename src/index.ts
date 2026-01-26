import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { CollectionConfig, generateMarkdown } from './generators/collection-generator';
import { generateTemplateList } from './generators/template-list-generator';

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('No parameters provided. Regenerating everything...');

    // 1. Regenerate all collections
    const collectionsDir = path.join('templates', 'collections');
    if (fs.existsSync(collectionsDir)) {
      const files = fs.readdirSync(collectionsDir).filter((f) => f.endsWith('.collection.yml'));
      for (const file of files) {
        processFile(path.join(collectionsDir, file));
      }
    }

    // 2. Regenerate template list
    generateTemplateList();
    return;
  }

  const inputPath = args[0];

  if (inputPath === '--template-list') {
    generateTemplateList();
    return;
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Path not found: ${inputPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(inputPath);
  if (stats.isDirectory()) {
    const files = fs.readdirSync(inputPath).filter((f) => f.endsWith('.collection.yml'));
    for (const file of files) {
      processFile(path.join(inputPath, file));
    }
  } else {
    processFile(inputPath);
  }
}

function processFile(yamlPath: string) {
  try {
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    const config = parse(yamlContent) as CollectionConfig;

    const markdown = generateMarkdown(config);

    const outputDir = path.dirname(yamlPath);
    const outputFileName = `${path.basename(yamlPath, '.collection.yml')}.md`;
    const outputPath = path.join(outputDir, outputFileName);

    fs.writeFileSync(outputPath, markdown, 'utf8');
    console.log(`Successfully generated: ${outputPath}`);
  } catch (error) {
    console.error(`Error processing collection ${yamlPath}:`, error);
  }
}

main();
