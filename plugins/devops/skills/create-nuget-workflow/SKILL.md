---
name: create-nuget-workflow
description: 'Create a GitHub Actions CI/CD workflow for building and publishing a NuGet package using GravionLabs/ci reusable workflows.'
allowed-tools: read write edit editFiles search codebase
model: gpt-4.1
---

Create a `.github/workflows/` file for NuGet package CI/CD using `GravionLabs/ci`.

## What this skill does
Scaffolds a GitHub Actions workflow that calls the `GravionLabs/ci` reusable NuGet package workflow to build, test, pack, and publish the package.

## Steps
1. Ask if not provided: workflow trigger (push to main, tags, PRs), NuGet feed (nuget.org or GitHub Packages)
2. Create `.github/workflows/ci.yml` (or `nuget.yml`):
   ```yaml
   name: CI

   on:
     push:
       branches: [main]
     pull_request:

   jobs:
     build:
       uses: GravionLabs/ci/.github/workflows/nuget.yml@main
       with:
         dotnet-version: '9.0.x'
       secrets: inherit
   ```
3. Ensure `GitVersion.yml` is present at the repo root (see `gitversion-add` skill)
4. Add `NUGET_API_KEY` secret guidance in a comment or README if publishing to nuget.org

## Constraints
- Use `secrets: inherit` to pass repository secrets to the reusable workflow
- The reusable workflow handles versioning via GitVersion — do not manually set package versions
- Do not duplicate build/test logic already in the reusable workflow

> 💡 **Model hint:** This is a mechanical task — a fast model like `gpt-4.1` is sufficient. Use `/model` to switch.
