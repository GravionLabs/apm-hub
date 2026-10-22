# Task issues inside a PBI

A PBI that needs two or more tasks gets `[Task] <conventional title>` sub-issues (label `task`), for example `[Task] chore: add task field to plan schema`. A PBI that fits one session gets no Task issue. Create them with `issue-planning`'s `references/publish.md` after the plan is approved.

Body, first line `Parent PBI: #<pbi>` (a Bug parent: `Parent Bug: #<bug>`):

```markdown
Parent PBI: #<pbi>

## Overview
<goal in one or two sentences>

## Implementation Notes
<how and where; exact files and symbols>

## Invariants
<optional: only for async, persistence or state-machine Tasks, written by `issue-planning`>

<!-- agent-ready:start -->
## Context
<what the implementer must know that the PBI does not say>

## Depends on
Blocked by #<task>, or none (also set as native blocked-by link)

## Files
- <path>

## Done when
- <observable result, tests included; names the interface(s) under test>
<!-- agent-ready:end -->
```

## Rules

- Native sub-issue link to the PBI and native blocked-by links in plan order (`sub-issues.md`); the body lines only document them.
- The Task issues are the source of truth; `<state>/<pbi>/plan.json` is a local cache of their numbers. A plan change during implementation edits the Task issue body (`gh issue edit`) or adds a new Task issue, then the cache.
- Commits on the PBI branch carry `Refs #<task>`, never `Closes`: the PBI's PR closes `#<pbi>` and the release closes the open sub-issues.
- Task sub-issues of a PBI never become separate branches or PRs on the remote: parallel Tasks (`task-waves.md`) work on local task branches `<type>/<pbi>-t<task>` that are cherry-picked onto the PBI branch and deleted; task branches are local only and never pushed. Existing hand-made Task sub-issues are used as they are, without re-planning.

## Commits, resume and review range (orchestrator)

- Task commits are made in the implement phase, one per task or more. Subject `<type>: <description> (#<pbi>)`, last footer line `Refs #<task>` alone on its line. A PBI with a single task has no Task issue: the footer is `Refs #<pbi>` and the report is `task-<plan id>-report.md` (e.g. `task-p1-report.md`); with Task issues it is `task-<task nr>-report.md`. After GATE 2 only an optional final fix commit is made; no extra commit of the whole diff.
- Task merged (any run), the one rule everyone refers to: `<task>` is digits only (`^[0-9]+$`). First `git fetch origin <integration-branch>`, then `git log -E --grep "^Refs #<task>$" origin/<integration-branch> --format=%h -1` finds a commit reachable from the remote integration branch (not only `..HEAD`; Task issues stay open because `Closes` fires only on the default branch; the anchors keep `#12` from matching `#123`; the match is per commit message, any line) → `gh issue close <task> --comment "Merged into <branch> in <sha>"`, skip it, never re-propose it. It relies on the `Refs #<task>` footer surviving: a squash merge that drops the footers hides merged tasks. Task done on the current branch (resume, no ledger): same grep on `origin/<integration-branch>..HEAD`. Single task: same grep with `<pbi>`.
- Open vs. all tasks: "no tasks yet" counts ALL `task` sub-issues, open and closed. Zero in total → plan. Tasks exist but none is open (all merged) → never re-plan, go to review of `<first BASE>..HEAD` (or the PR) for the work already on the integration branch. That range empty (everything already merged): stop and report "already merged" with the SHAs the "Task merged" grep found (or review those commits); never run `review-fanout` on an empty diff.
- Review range `<first BASE>..HEAD`: `BASE` of the first task is `git merge-base HEAD origin/<integration-branch>` when the ledger is missing; the PBI branch holds only its own commits.
- PR task list, one line per task: `#<task> — <sha>`, the LAST commit sha carrying that task's `Refs` footer when it has several commits; a single task without issue: `#<pbi> — <sha>`.
- Only sub-issues labelled `task` are tasks of the PBI's branch. Children labelled `pbi` (of a Feature or Epic) are separate PBIs with their own branch (`batch-workflow.md`).
- Hand-made Task issues have no `plan.json`: use them as they are, `model` defaults to `sonnet`, no `size: L` quick review; blocking order comes from the native blocked-by links.
