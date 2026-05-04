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

Executes precise git operations — branch creation, staged commits, and remote
push. Never modifies source files.

## Instructions

### Fetch origin/main

When asked to pre-fetch or refresh origin/main:
```powershell
git fetch origin main
```
Report success or any errors.

### Create Branch

When asked to create a branch (branch name is always provided by the caller):
```powershell
git fetch origin main
git checkout -b <branch-name> origin/main
```
- Always base the branch on `origin/main`, never on the local `main`.
- The `git checkout -b` output confirms successful branch creation.

### Stage and Commit

When asked to commit with a provided message and description:
```powershell
git status
git add -A
git commit -m "<message>" -m "<description>"
git log --oneline -1
```
- The commit message must match: `#<TicketNumber> <Title>`
- If `git status` shows no changes, report this and do not create an empty commit.
- Show the short commit hash from `git log --oneline -1` as confirmation.

### Push Branch to Remote

When asked to push the current branch to remote (required before PR creation):
```powershell
git push --set-upstream origin <branch-name>
```
Report the pushed branch name and remote URL.

### Gotchas

- **Local `main` vs. `origin/main`**: Always base new branches on `origin/main` (remote), not the local `main`. The remote is the source of truth.
- **English-only branch and commit names**: All branch names and commit messages must be in English. Translate non-English ticket titles and descriptions before generating names.
- **No source file modifications**: This skill only performs git operations; it never modifies repository files.

### Rules
- Never push unless explicitly instructed to do so.
- Never modify any source files.
- Run all commands in the current working directory.
