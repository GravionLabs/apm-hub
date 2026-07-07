---
name: github-issue
description: 'Implement GitHub issues or epics: read issue, branch, implement, verify, PR, merge. Routing skill: detects whether the input is an epic (issue body contains a `- [ ] #N` sub-issue checklist) or a standalone issue and follows the matching reference. Use for any GitHub issue work — single issues start to finish, or batch requests like "implement all epics" / "work through these issues one by one".'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
---

## Overview

Single entry point for the GitHub issue lifecycle. Detect the shape of the input, then strictly follow the matching reference document.

## Prerequisites

- `gh` CLI authenticated (`gh auth status`)
- Run from repo root
- Check `git status` first; never commit unrelated pre-existing changes (add files explicitly, never `git add -A`/`.`)

## Routing

1. Read the issue(s): `gh issue view <nr> --json title,body,labels`
2. Pick the workflow:
   - **Epic / batch** — the issue body contains a checklist of sub-issues (`- [ ] #N`), or the user asks to implement several issues/epics in sequence: strictly follow `references/epic-batch.md`.
   - **Standalone issue** — no sub-issue checklist: strictly follow `references/standalone-issue.md`.

## Shared constraints (both workflows)

- Branch names include the issue number; derive `<slug>` from the issue title (lowercase, spaces → `-`, drop parenthetical scope, max ~40 chars).
- One logical change per commit; commit format per `references/conventional-commits.md`.
- Commit and PR titles reference the issue: `<type>: <description> (#<nr>)`; the PR body contains `Closes #<nr>` for every issue it completes.
- Verify before every commit: run build + full test suite (load the `detect-techstack` skill if the project's commands are unknown). Never commit or move on with a red suite.
- Never merge a PR with failing checks.
