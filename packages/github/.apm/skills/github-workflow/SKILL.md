---
name: github-workflow
description: "Generic GitHub workflow — creates pull requests, links issues, and manages GitHub-based development. Use this skill for any GitHub PR or issue linking operation. Preferred model: gpt-4.1."
model: gpt-4.1
allowed-tools: shell execute runCommands mcp_github_create_pull_request mcp_github_list_pull_requests
---

## Overview

Creates pull requests and links GitHub issues. Caller always provides the PR title,
description, and issue number.

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth login`)
- Run from the repository root with the branch already pushed

## Instructions

### Create Pull Request

*Primary — MCP:*

```
mcp_github_create_pull_request(
  owner: <owner>,
  repo: <repo>,
  title: "#<IssueNumber> <Title>",
  body: "<Description>\n\nCloses #<IssueNumber>",
  head: <branch>,
  base: "main"
)
```

*Fallback — gh CLI:*

```powershell
gh pr create \
  --title "#<IssueNumber> <Title>" \
  --body "<Description>\n\nCloses #<IssueNumber>" \
  --base main
```

Confirm the PR number and URL after creation.

## Gotchas

- PR titles and descriptions **must be in English** — translate before creating.
- Never manually close issues; `Closes #<IssueNumber>` in the body auto-closes on merge.
- Always base PRs on `main` unless explicitly told otherwise.
- To verify a PR is linked: check the body for `Closes #<IssueNumber>` via
  `mcp_github_list_pull_requests` or `gh pr view <pr-number> --json body`.
- To view PR details: `gh pr view <pr-number> --json title,body,number,url,state`.
- Never modify source files — only manage git and GitHub operations.
