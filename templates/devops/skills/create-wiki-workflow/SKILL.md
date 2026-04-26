---
name: create-wiki-workflow
description: 'Create a GitHub Actions workflow that syncs a docs/ directory to the GitHub Wiki using GravionLabs/ci reusable workflows.'
allowed-tools: write edit editFiles
model: gpt-4.1
---

Create a `.github/workflows/sync-wiki.yml` file that syncs documentation to the GitHub Wiki.

## What this skill does
Scaffolds a GitHub Actions workflow that calls the `GravionLabs/ci` reusable Wiki Sync workflow to publish Markdown files from a `docs/` directory to the repository's GitHub Wiki.

## Steps
1. Create `.github/workflows/sync-wiki.yml`:
   ```yaml
   name: Sync Wiki

   on:
     push:
       branches: [main]
       paths:
         - 'docs/**'

   jobs:
     sync-wiki:
       uses: GravionLabs/ci/.github/workflows/sync-wiki.yml@main
       with:
         docs-path: docs
       secrets: inherit
   ```
2. Confirm the repository has the Wiki enabled (Settings → Features → Wikis)
3. Note: the `GITHUB_TOKEN` must have write permissions to the wiki — `secrets: inherit` passes it automatically

## Constraints
- Trigger only on changes to docs files to avoid unnecessary runs
- The `docs/` directory should contain Markdown files following the GitHub Wiki format
- The home page should be `docs/Home.md`
- Do not add redundant build steps — wiki sync only needs to copy files

> 💡 **Model hint:** This is a mechanical task — a fast model like `gpt-4.1` is sufficient. Use `/model` to switch.
