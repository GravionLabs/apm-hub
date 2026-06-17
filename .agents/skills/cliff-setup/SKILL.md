---
name: cliff-setup
description: >
  Set up git-cliff for conventional-commit changelog generation and integrate it
  into the project workflow. Installs git-cliff, creates or validates cliff.toml
  configuration, generates CHANGELOG.md, and adds a changelog script to
  package.json. Use this skill when setting up changelog generation or updating
  the changelog before a release.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
---

## Overview

Set up git-cliff for automated CHANGELOG.md generation from conventional commits. Works in four phases: install git-cliff, configure cliff.toml, generate/update the changelog, and integrate into the project workflow.

Avoid verbose reasoning.

## Prerequisites

- Git repository with conventional commits
- Project root with `package.json` (for script integration)

## Instructions

### Phase 1 — Install git-cliff

1. Check if git-cliff is installed: `git-cliff --version`
2. If not installed, install via cargo (preferred) or npm:
   ```powershell
   cargo install git-cliff
   ```
   Fallback:
   ```powershell
   pnpm add -g git-cliff
   ```
   or:
   ```powershell
   npm install -g git-cliff
   ```
3. ✓ **Checkpoint:** git-cliff installed. Ready for Phase 2.

### Phase 2 — Configure cliff.toml

4. Check if `cliff.toml` exists in project root.
5. If not present, create `cliff.toml` with standard configuration:
   - Conventional commit parsing enabled
   - Group commits by type (feat, fix, docs, perf, refactor)
   - Skip chore/ci/test/style/build commits
6. Validate the configuration:
   ```powershell
   git-cliff -c cliff.toml --help 2>$null
   ```
7. ✓ **Checkpoint:** Config ready. Ready for Phase 3.

### Phase 3 — Generate or Update CHANGELOG.md

8. Check if tags exist:
   ```powershell
   git tag --list 'v*' | Select-Object -First 1
   ```
9. **Initial generation** (no prior changelog):
   ```powershell
   git-cliff -c cliff.toml -o CHANGELOG.md
   ```
10. **Incremental update** (existing changelog with prior tags):
    ```powershell
    git-cliff -c cliff.toml -o CHANGELOG.md --unreleased -t v{next-version}
    ```
11. ✓ **Checkpoint:** Changelog generated. Ready for Phase 4.

### Phase 4 — Integrate into Workflow

12. Add changelog script to `package.json`:
    ```json
    "scripts": {
      "changelog": "git-cliff -c cliff.toml -o CHANGELOG.md"
    }
    ```
13. For incremental release workflow, also add:
    ```json
    "scripts": {
      "changelog:release": "git-cliff -c cliff.toml -o CHANGELOG.md --unreleased -t v{version}"
    }
    ```
14. ✓ **Checkpoint:** Integration complete. Changelog workflow ready.

## Gotchas

- The first `git-cliff` run generates the full changelog from all git history. For large repos, this may include many commits — review and trim if needed.
- Incremental updates require proper git tags in `v{major}.{minor}.{patch}` format (e.g. `v1.0.0`).
- If `cliff.toml` already has project-specific customizations, do not overwrite — only validate and update the configuration.
- git-cliff uses the current branch's commit history. Checkout the target branch before generating.

## Output Format

### ✅ Summary
git-cliff {version} configured for {project}. CHANGELOG.md generated/integrated.

### 📝 What Changed
- Created/Updated: `cliff.toml`
- Created/Updated: `CHANGELOG.md`
- Modified: `package.json` (scripts.changelog)

### ✔️ Verify
```powershell
git-cliff --version
head -5 CHANGELOG.md
```

### 🚀 Next Steps
1. Review and commit the updated CHANGELOG.md
2. Add changelog generation to release CI workflow
3. Consider adding `"changelog:release"` npm script for automated release notes
