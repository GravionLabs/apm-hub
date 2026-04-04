---
name: gitversion-add
description: 'Add GitVersion to a repository for automatic semantic versioning from git history, configured for use with GravionLabs/ci reusable workflows.'
allowed-tools: editFiles codebase
---

Set up GitVersion for automatic semantic versioning based on git history.

## What this skill does
Creates a `GitVersion.yml` configuration file and updates CI workflow files to use GitVersion for version calculation. Designed for use with `GravionLabs/ci` reusable workflows.

## Steps
1. Create `GitVersion.yml` at the repository root:
   ```yaml
   mode: Mainline
   branches:
     main:
       regex: ^main$
       increment: Patch
       prevent-increment-of-merged-branch-version: true
     feature:
       regex: ^feature/
       increment: Minor
     fix:
       regex: ^fix/
       increment: Patch
     release:
       regex: ^release/
       increment: None
   ```
2. Adjust `mode` based on branching strategy:
   - `Mainline`: trunk-based (default)
   - `GitFlow`: feature branch heavy
3. Update `.github/workflows/` files to pass the calculated version to build/publish steps
4. Add `gitversion` to the CI setup steps if using `GravionLabs/ci` — it handles this automatically

## Constraints
- `GitVersion.yml` must be at the repository root
- Do not commit version numbers in source files — let GitVersion calculate them at build time
- For `GravionLabs/ci` workflows: GitVersion integration is handled by the reusable workflow; manual configuration in the workflow file is not needed
