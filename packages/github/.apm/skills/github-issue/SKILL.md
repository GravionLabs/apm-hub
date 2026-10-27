---
name: github-issue
description: 'Implement GitHub issues by type (Epic, Feature, PBI, Task), single or batch. Use for any GitHub issue work.'
---

## Overview

Single entry point for the GitHub issue lifecycle. Detect the issue type and shape of the input, then strictly follow the matching reference document. One issue per session.

## Prerequisites

- `gh` CLI authenticated (`gh auth status`)
- Run from repo root
- Check `git status` first; never commit unrelated pre-existing changes (add files explicitly, never `git add -A`/`.`)

## Issue Types

Issues follow this hierarchy (defined in `issue-templates/`):

| Label     | Title (always `[<Level>] <summary>`)                  | Sub-issues    |
| --------- | ----------------------------------------------------- | ------------- |
| `epic`    | `[Epic] <outcome>`                                    | Features      |
| `feature` | `[Feature] <capability>`                              | PBIs          |
| `pbi`     | `[PBI] feat(scope): …`, `[PBI] refactor: …`           | Tasks (opt.)  |
| `task`    | `[Task] chore: …`, `[Task] feat: …`                   | —             |
| `bug`     | `[Bug] fix: <symptom>`                                | Tasks (opt.)  |

Titles are always written with the bracket prefix. Legacy titles (`Epic: …`, `Feature: …`, `[EPIC] …`) are still recognized when reading, never written.

Parent/child links are **native GitHub sub-issues** — see `references/sub-issues.md` for how to
read, create, move and verify them. Markdown checklists are not used. Task sub-issues of a PBI follow `references/task-issues.md` and never become separate branches or PRs.

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

- Work branches are cut from and merged into the integration branch (`release/next` by default, explicit `release/<x.y>` only for parallel lines), never `main` (`references/release-branches.md`); `github-release` cuts and finishes it.
- Branch name `<type>/<nr>-<slug>` per `references/conventional-commits.md`; `<slug>` from the issue title after stripping `^\[(Epic|Feature|PBI|Task|Bug)\] ` (case-insensitive) and the legacy `Epic: ` / `Feature: `, then the conventional type and scope (lowercase, spaces → `-`, drop parenthetical scope, max ~40 chars).
- One logical change per commit; commit format per `references/conventional-commits.md`.
- Commit and PR titles reference the issue: `<type>: <description> (#<nr>)`; the PR body contains `Closes #<nr>` for every issue it completes (only partly delivered: `Refs #<nr>` and `## Not delivered`, see `github-pull-request`).
- Two-stage verify (load `detect-techstack` if the project's commands are unknown): per commit run the build only when the stack compiles and compiled sources changed, plus targeted tests (test files of the changed paths and their direct neighbours; unknown mapping: the project's fast/unit group, never the full suite). Before the pull request ONE full run, and again after the last fix round. Never commit or move on with a red run.
- Never merge a PR with failing checks.
- Closing a child is all that's needed — the native sub-issue link updates the parent's progress automatically. There is no checklist to tick. If a child turns out not to be linked to its parent, link it (`references/sub-issues.md`) instead of adding a checklist.
