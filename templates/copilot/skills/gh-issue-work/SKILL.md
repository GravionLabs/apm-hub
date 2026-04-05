---
name: gh-issue-work
description: 'End-to-end workflow for a GitHub issue: read issue, create branch, implement with tests and docs, review, and open a pull request.'
allowed-tools: codebase editFiles runCommands
model: claude-sonnet-4.6
---

Complete end-to-end workflow for a GitHub issue — from branch creation to pull request.

## What this skill does
Combines `gh-issue-implement` and `gh-issue-finish` into a single workflow for straightforward issues.

> **Tip:** For complex issues, use the individual skills:
> 1. `gh-issue-implement {issue-number}` — branch + implementation
> 2. `gh-issue-finish {issue-number}` — review + PR

## Prerequisites
- `gh` CLI installed and authenticated (`gh auth status`)
- Run from the repository root

## Steps

### Phase 1 — Prepare
1. `gh issue view {issue-number} --json title,body,labels,assignees`
2. Determine branch prefix from labels (`feature/`, `fix/`, `chore/`, `docs/`)
3. `git checkout -b <prefix>/<issue-number>-<slug>`

### Phase 2 — Implement
4. Explore affected areas of the codebase
5. Write code, tests, and update docs as needed
6. Atomic commits: `git commit -m "<type>: <description> (#<issue-number>)"`

### Phase 3 — Finish
7. Run build and tests — fix any failures
8. Self-review: `git diff main...HEAD`
9. Push and open PR: `git push -u origin HEAD && gh pr create ...`
10. Verify CI: `gh pr checks`

## Constraints
- Tests must pass before the PR is opened
- PR body must include `Closes #<issue-number>`
