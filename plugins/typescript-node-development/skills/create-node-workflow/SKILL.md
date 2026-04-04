---
name: create-node-workflow
description: 'Create a GitHub Actions CI workflow for a Node.js project using GravionLabs/ci reusable workflows (install, lint, test, build).'
allowed-tools: editFiles codebase
---

Create a `.github/workflows/` file for Node.js CI using `GravionLabs/ci`.

## What this skill does
Scaffolds a GitHub Actions workflow that calls the `GravionLabs/ci` reusable Node.js CI workflow to install dependencies, lint, test, and build the project.

## Steps
1. Ask if not provided: Node.js version, package manager (npm / pnpm / yarn), whether to publish (npm registry / GitHub Packages / none)
2. Create `.github/workflows/ci.yml`:
   ```yaml
   name: CI

   on:
     push:
       branches: [main]
     pull_request:

   jobs:
     build:
       uses: GravionLabs/ci/.github/workflows/node.yml@main
       with:
         node-version: '22'
       secrets: inherit
   ```
3. Confirm `package.json` has `test`, `build`, and `lint` scripts
4. If publishing: confirm `NPM_TOKEN` secret is configured

## Constraints
- Use `secrets: inherit` to pass secrets to the reusable workflow
- `package.json` must define `test` and `build` scripts — the reusable workflow calls them
- Do not hardcode Node.js version if the project uses `.nvmrc` — check if the reusable workflow reads it automatically
