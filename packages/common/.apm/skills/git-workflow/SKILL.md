---
name: git-workflow
description: "Generic git workflow — fetches from origin/main, creates branches, stages files, creates structured commits, and pushes to remote. Use this skill for any git branch, commit, or push operation. Preferred model: gpt-4.1."
model: gpt-4.1
allowed-tools: shell
---

## Instructions

This skill executes precise git operations. It never modifies source files.

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
git branch --show-current
```
- Always base the branch on `origin/main`, never on the local `main`.
- Confirm the active branch after creation.

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

### Rules
- **All branch names and commit messages MUST be in English.** If the ticket title or description is in any non-English language, translate it to English before generating the branch name or commit message. Never use non-English characters in branch names or commit messages.
- Never push unless explicitly instructed to do so.
- Never modify any source files.
- Run all commands in the current working directory.
