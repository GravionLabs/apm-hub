---
name: create-node-workflow
description: 'Create a GitHub Actions CI workflow for a Node.js project using GravionLabs/ci reusable workflows (install, lint, test, build).'
allowed-tools: read write edit editFiles search codebase
model: gpt-4.1
---

Create `.github/workflows/` file for Node.js CI using `GravionLabs/ci`.

## Steps
1. Ask: Node.js version, package manager (npm / pnpm / yarn), whether publish (npm registry / GitHub Packages / none)
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
4. If publishing: confirm `NPM_TOKEN` secret configured

## Constraints
- Use `secrets: inherit` to pass secrets
- `package.json` must define `test` and `build` scripts — reusable workflow calls them
- Do not hardcode Node.js version if project uses `.nvmrc` — check if reusable workflow reads it automatically
