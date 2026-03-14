---
agent: agent
tools: ['editFiles', 'search/codebase']
description: 'Add GitVersion to a repository for automatic semantic versioning from git history'
---

# Add GitVersion Configuration

Set up [GitVersion](https://gitversion.net/) for automatic semantic versioning based on the git history.
GitVersion is used by the `GravionLabs/ci` reusable workflows to determine package versions.

## Step 1 — Gather information

Ask the user for the following:

- **Branching model**: Which branching model does the repository use?
  - `github-flow` — Simple: `main` + short-lived feature branches. Recommended for libraries and small teams.
  - `gitflow` — Full GitFlow: `main`, `develop`, `release/*`, `hotfix/*`. For complex release schedules.
  - `trunk-based` — Trunk-based development: commits directly to `main`, feature flags for WIP.
- **Tag prefix** (optional): Prefix for git version tags. Common values: `v` (produces `v1.2.3`) or empty (produces `1.2.3`). Default: `v`.
- **Existing `GitVersion.yml`?** — check if one already exists; if so, ask whether to replace or update it.

## Step 2 — Generate `GitVersion.yml`

Create `GitVersion.yml` in the repository root with configuration matching the chosen branching model.

### GitHub Flow (recommended):

```yaml
# GitVersion.yml
# Configured for GitHub Flow: main + feature branches
assembly-versioning-scheme: MajorMinorPatch
mode: ContinuousDelivery
tag-prefix: 'v'

branches:
  main:
    regex: ^main$
    label: ''
    increment: Patch
    prevent-increment-of-merged-branch-version: true
    track-merge-target: false
    tracks-release-branch: false
    is-release-branch: true
    is-mainline: true
    pre-release-weight: 55000

  feature:
    regex: ^features?[/-]
    label: alpha
    increment: Inherit
    source-branches: [main]
    pre-release-weight: 30000

  pull-request:
    regex: ^(pull|pull\-requests|pr)[/-]
    label: PR{BranchPrNumber}
    increment: Inherit
    source-branches: [main, feature]
    pre-release-weight: 30000
```

### GitFlow:

```yaml
# GitVersion.yml
# Configured for GitFlow: main, develop, release/*, hotfix/*
assembly-versioning-scheme: MajorMinorPatch
mode: ContinuousDelivery
tag-prefix: 'v'

branches:
  main:
    regex: ^main$
    label: ''
    increment: Patch
    is-mainline: true
    is-release-branch: true
    pre-release-weight: 55000

  develop:
    regex: ^dev(elop)?(ment)?$
    label: alpha
    increment: Minor
    source-branches: [main]
    pre-release-weight: 30000

  release:
    regex: ^releases?[/-]
    label: beta
    increment: None
    source-branches: [develop]
    is-release-branch: true
    pre-release-weight: 40000

  feature:
    regex: ^features?[/-]
    label: alpha
    increment: Inherit
    source-branches: [develop]
    pre-release-weight: 20000

  hotfix:
    regex: ^hotfix(es)?[/-]
    label: hotfix
    increment: Patch
    source-branches: [main]
    pre-release-weight: 50000

  pull-request:
    regex: ^(pull|pull\-requests|pr)[/-]
    label: PR{BranchPrNumber}
    increment: Inherit
    source-branches: [main, develop, release, hotfix, feature]
    pre-release-weight: 30000
```

### Trunk-based:

```yaml
# GitVersion.yml
# Configured for trunk-based development (all commits to main)
assembly-versioning-scheme: MajorMinorPatch
mode: ContinuousDeployment
tag-prefix: 'v'

branches:
  main:
    regex: ^main$
    label: ''
    increment: Patch
    is-mainline: true
    is-release-branch: true
    pre-release-weight: 55000

  feature:
    regex: ^features?[/-]
    label: alpha
    increment: Inherit
    source-branches: [main]
    pre-release-weight: 30000
```

## Step 3 — Version bump via commit messages

Explain to the user how to control version increments using commit message conventions:

| Commit message pattern | Version bump |
|------------------------|-------------|
| `feat: ...` | minor bump (1.x.0) |
| `fix: ...`, `chore: ...`, normal commits | patch bump (1.0.x) |
| `BREAKING CHANGE:` in body or footer | major bump (x.0.0) |
| `+semver: major` anywhere in message | major bump |
| `+semver: minor` anywhere in message | minor bump |
| `+semver: none` / `+semver: skip` | no version bump |

## Step 4 — First version tag

If no version tags exist yet, GitVersion will start at `0.1.0`. To start at `1.0.0`, create an initial tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Step 5 — Verify locally (optional)

If the user has the `dotnet-gitversion` tool installed, they can test the configuration:

```bash
dotnet gitversion /showvariable SemVer
```
