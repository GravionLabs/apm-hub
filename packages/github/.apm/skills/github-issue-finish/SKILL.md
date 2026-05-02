---
name: github-issue-finish
description: 'Review implementation and create a GitHub pull request. Run after github-issue-start when implementation is complete.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase mcp_github_create_pull_request mcp_github_get_issue
model: gpt-4.1
---

Review the implementation and open a pull request for a GitHub issue.

## Prerequisites
- Issue is implemented (`github-issue-start` completed)
- Branch is pushed to origin
- Run from the repository root

## Steps

### 1. Verify build and tests
Run the full build and test suite for the project. Fix any failures before continuing.

### 2. Self-review changes
- `git diff main...HEAD` — review all changes
- Check for: leftover debug code, missing error handling, incomplete TODOs, missing tests

### 3. Create the pull request

*Primary — github-pull-request agent:*
Run `@github-pull-request {issue-number}` to auto-generate PR title and body.

*Secondary — MCP:*
```
mcp_github_create_pull_request(
  owner: <owner>,
  repo: <repo>,
  title: "<type>: <description> (#<issue-number>)",
  body: "<body with Closes #<issue-number>>",
  head: <branch>,
  base: "main"
)
```

*Fallback — gh CLI:*
```bash
gh pr create \
  --title "<type>: <description> (#<issue-number>)" \
  --body "$(cat .apm/skills/github-issue-finish/templates/pr-body.md)"
```

### 4. Confirm
- Verify the PR link is accessible
- Check CI status: `gh pr checks`

## Constraints
- PR title must reference the issue number
- All CI checks should be green before requesting review
- Link the issue with `Closes #<issue-number>` in the PR body

> 💡 **Model hint:** This is a mechanical task — a fast model like `gpt-4.1` is sufficient. Use `/model` to switch.
