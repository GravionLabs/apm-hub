---
name: git-workflow
description: >
  Generic git workflow — fetches from origin/main, creates branches, stages
  files, creates structured commits, and pushes to remote. Use this skill for
  any git branch, commit, or push operation.
model: gpt-4.1
allowed-tools: execute shell runCommands
---

## Overview

Git operations — branch creation, staged commits, remote push. Never modifies source files.

## Instructions

### Fetch origin/main

On pre-fetch or refresh origin/main:
```powershell
git fetch origin main
```
Report success or errors.

### Create Branch

On create branch (name from caller):
```powershell
git fetch origin main
git checkout -b <branch-name> origin/main
```
- Base branch on `origin/main`, not local `main`.
- `git checkout -b` output confirms creation.

### Stage and Commit

On commit with message + description:
```powershell
git status
git add -A
git commit -m "<message>" -m "<description>"
git log --oneline -1
```
- Commit message: `#<TicketNumber> <Title>`
- No changes? Report it. No empty commit.
- Show short commit hash from `git log --oneline -1`.

### Push Branch to Remote

Push current branch to remote (before PR):
```powershell
git push --set-upstream origin <branch-name>
```
Report pushed branch name + remote URL.

### Gotchas

- **Local `main` vs. `origin/main`**: Base on `origin/main` (remote). Remote = source of truth.
- **English-only names**: Branch names + commit messages English. Translate non-English titles before generating.
- **No source modifications**: Git operations only.

### Rules
- Never push unless instructed.
- Never modify source files.
- Run commands in current directory.
