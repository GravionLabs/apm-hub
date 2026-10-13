# Task issues inside a PBI

A PBI that needs two or more tasks gets `[Task] <conventional title>` sub-issues (label `task`), for example `[Task] chore: add task field to plan schema`. A PBI that fits one session gets no Task issue. Create them with `issue-planning`'s `references/publish.md` after the plan is approved.

Body, first line `Parent PBI: #<pbi>`:

```markdown
Parent PBI: #<pbi>

## Overview
<goal in one or two sentences>

## Implementation Notes
<how and where; exact files and symbols>

<!-- agent-ready:start -->
## Context
<what the implementer must know that the PBI does not say>

## Depends on
Blocked by #<task>, or none (also set as native blocked-by link)

## Files
- <path>

## Done when
- <observable result, tests included>
<!-- agent-ready:end -->
```

## Rules

- Native sub-issue link to the PBI and native blocked-by links in plan order (`sub-issues.md`); the body lines only document them.
- The Task issues are the source of truth; `.agents/<pbi>/plan.json` is a local cache of their numbers. A plan change during implementation edits the Task issue body (`gh issue edit`) or adds a new Task issue, then the cache.
- Commits on the PBI branch carry `Refs #<task>`, never `Closes`: the PBI's PR closes `#<pbi>` and the release closes the open sub-issues.
- Task sub-issues of a PBI never become separate branches or PRs. Existing hand-made Task sub-issues are used as they are, without re-planning.
