---
name: create-pr
description: 'Analyze git history and diff, generate a structured PR description, and create a pull request.'
allowed-tools: runCommands codebase
model: gpt-4.1
---

Create a well-structured pull request by analyzing the current branch's commits and diff.

## Stack
- **CLI:** `gh` — GitHub CLI (key commands: `gh pr create`, `gh pr view`, `git log`, `git diff`)

## What this skill does
Analyzes git history and file changes, generates a structured PR title and description, and creates the PR on GitHub or Azure DevOps.

## Steps
1. Determine base branch (default: `main`)
2. Analyze:
   ```bash
   git log main..HEAD --oneline
   git diff main..HEAD --stat
   ```
3. Generate PR content:
   - **Title**: imperative mood, max 72 chars (e.g., "feat: add user authentication")
   - **Description**:
     - `## Summary` — what changed and why
     - `## Changes` — bullet list of key changes
     - `## Testing` — steps to verify
     - `Closes #<issue>` if commits reference an issue
4. Create PR:
   - GitHub: `gh pr create --title "..." --body "..." --base main`
   - Azure DevOps: `az repos pr create --title "..." --description "..." --target-branch main`
5. Output the PR URL
