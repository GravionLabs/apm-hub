---
name: github-issue-workflow
description: 'End-to-end workflow for a GitHub issue: read issue, create branch, implement with tests and docs, review, and open a pull request.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase mcp_github_get_issue mcp_github_create_branch mcp_github_create_pull_request mcp_github_list_pull_requests
model: claude-sonnet-4.6
---

End-to-end GitHub issue workflow — branch creation through pull request.

## What this skill does

Combines `github-issue-start` and `github-issue-finish` into one command.
For complex issues, run the two skills separately for better control.

## Steps

1. Execute `github-issue-start {issue-number}` in full — complete all four phases.
2. Execute `github-issue-finish {issue-number}` — verify, review, and open the PR.

## Constraints

- Do not skip any phases from either sub-skill.
- Tests must pass before the PR is opened.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better).
