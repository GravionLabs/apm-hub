---
name: github-issue-workflow
description: 'End-to-end workflow for a GitHub issue: read issue, create branch, implement with tests and docs, review, and open a pull request.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase mcp_github_get_issue mcp_github_create_branch mcp_github_create_pull_request mcp_github_list_pull_requests
model: claude-sonnet-4.6
---

Complete end-to-end workflow for a GitHub issue — from branch creation to pull request.

## What this skill does
Combines `github-issue-start` and `github-issue-finish` into a single workflow for straightforward issues.

> **Tip:** For complex issues, use the individual skills:
> 1. `github-issue-start {issue-number}` — branch + implementation
> 2. `github-issue-finish {issue-number}` — review + PR

## Prerequisites
- `gh` CLI installed and authenticated (`gh auth status`) — used as fallback when GH MCP is unavailable
- Run from the repository root

## Steps

### Phase 1 — Prepare

*Primary — GH MCP:*
1. Call `mcp_github_get_issue` to read title, body, and labels
2. Determine branch prefix from labels: `feature/`, `bugfix/`, `hotfix/`, `chore/`
3. Call `mcp_github_create_branch` to create the branch, then `git checkout <branch>`

*Fallback — GH CLI (when MCP not available):*
1. `gh issue view {issue-number} --json title,body,labels,assignees`
2. Determine branch prefix from labels: `feature/`, `bugfix/`, `hotfix/`, `chore/`
3. `git checkout -b <prefix>/<issue-number>-<slug>`

### Phase 2 — Implement
4. Explore affected areas of the codebase
5. Write code, tests, and update docs as needed
6. Atomic commits: `git commit -m "<type>: <description> (#<issue-number>)"`

### Phase 3 — Finish
7. Run build and tests — fix any failures
8. Self-review: `git diff main...HEAD`
9. Push: `git push -u origin HEAD`
10. Open PR via `@github-pull-request {issue-number}` or manually: `gh pr create ...`
11. Verify CI: `gh pr checks`

## Constraints
- Tests must pass before the PR is opened
- PR body must include `Closes #<issue-number>`

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
