---
name: code-review-publisher
description: 'Publish code review results as PR comments on GitHub or Azure DevOps.'
allowed-tools: runCommands codebase
---

Publish structured code review feedback as pull request comments.

## Stack
- **CLI:** `gh` — GitHub CLI (key commands: `gh pr comment`, `gh pr review`)
- **CLI:** `az devops` — Azure DevOps CLI (key commands: `az repos pr create`, `az devops invoke`)

## What this skill does
Reads code review results and posts them as PR comments using `gh` (GitHub) or `az devops` (Azure DevOps).

## Steps
1. Detect platform from git remote URL (github.com → GitHub CLI, dev.azure.com → Azure DevOps CLI)
2. Find the open PR for the current branch
3. Format each review item (inline comment with file path + line, or general comment)
4. Post comments:
   - GitHub: `gh pr comment <number> --body "..."`
   - Azure DevOps: REST API via `az devops invoke`
5. Confirm each posted comment with PR number and platform
