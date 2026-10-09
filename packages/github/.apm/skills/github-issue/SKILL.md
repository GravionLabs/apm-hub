---
name: github-issue
description: 'Implement GitHub issues following the project issue hierarchy (Epic→Feature→PBI→Task, Bug→Task). Routing skill: reads the issue type from labels and whether the issue has native sub-issues, then dispatches to the matching workflow reference. Use for any GitHub issue work — single issues or batch.'
---

## Overview

Single entry point for the GitHub issue lifecycle. Detect the issue type and shape of the input, then strictly follow the matching reference document.

## Prerequisites

- `gh` CLI authenticated (`gh auth status`)
- Run from repo root
- Check `git status` first; never commit unrelated pre-existing changes (add files explicitly, never `git add -A`/`.`)

## Issue Types

Issues follow this hierarchy (defined in `issue-templates/`):

| Label     | Title convention                                      | Sub-issues    |
| --------- | ----------------------------------------------------- | ------------- |
| `epic`    | Per the repo's Epic template                          | Features      |
| `feature` | Per the repo's Feature template                       | PBIs          |
| `pbi`     | Conventional commit: `feat: …`, `refactor: …`, …     | Tasks (opt.)  |
| `task`    | Conventional commit: `chore: …`, `feat: …`, …         | —             |
| `bug`     | `fix: <symptom>`                                      | Tasks (opt.)  |

Epic and Feature title conventions vary by repo — some use a `Epic: ` prefix, others `[Epic] `.
Read `.github/ISSUE_TEMPLATE/` in the target repo and match what is already there rather than
assuming. Never mix two conventions within one repo.

Parent/child links are **native GitHub sub-issues** — see `references/sub-issues.md` for how to
read, create, move and verify them. Markdown checklists are not used.

## Routing

1. Read the issue(s): `gh issue view <nr> --json title,body,labels`
2. Detect type from the `labels` field (`epic` / `feature` / `pbi` / `task` / `bug`)
3. Check whether it has children:
   `gh api repos/{owner}/{repo}/issues/<nr>/sub_issues --jq 'length'`
4. Pick the workflow:

   | Issue type              | Has sub-issues | Workflow reference                                  |
   | ----------------------- | -------------- | --------------------------------------------------- |
   | `epic`                  | yes (always)   | `references/batch-workflow.md` (use the `epic` row)    |
   | `feature`, `pbi`, `bug` | yes            | `references/batch-workflow.md` (row for the type)      |
   | any                     | no             | `references/standalone-issue.md`                       |
   | `task`                  | —              | `references/standalone-issue.md`                       |

   **Batch user requests** ("implement all PBIs in feature #12", "work through these issues"): collect the target issues, then process each one sequentially with the appropriate workflow above.

## Shared constraints (all workflows)

- Branch names include the issue number; derive `<slug>` from the issue title (lowercase, spaces → `-`, drop parenthetical scope, max ~40 chars).
- One logical change per commit; commit format per `references/conventional-commits.md`.
- Commit and PR titles reference the issue: `<type>: <description> (#<nr>)`; the PR body contains `Closes #<nr>` for every issue it completes.
- Verify before every commit: run build + full test suite (load the `detect-techstack` skill if the project's commands are unknown). Never commit or move on with a red suite.
- Never merge a PR with failing checks.
- Closing a child is all that's needed — the native sub-issue link updates the parent's progress automatically. There is no checklist to tick. If a child turns out not to be linked to its parent, link it (`references/sub-issues.md`) instead of adding a checklist.
