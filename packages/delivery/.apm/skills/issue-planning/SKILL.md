---
name: issue-planning
description: 'Plan an issue one level down with blockers and sizes; writes plan.json. Use for "plan issue #N".'
---

Planning only: no source edits, no issue creation, no questions to the user (open decisions go into `questions[]`, see `references/questions.md`). The plan is the reply; the caller creates the issues.

## Depth (exploration budget)

Pick from the request ("quick plan", "deep planning") or default to **standard**.

| Depth    | Exploration                                                     |
|----------|-----------------------------------------------------------------|
| quick    | ~5 key files                                                    |
| standard | Grep/glob/read affected and related code                        |
| deep     | Standard + call sites, tests, docs of every affected area       |

Depth limits exploration, not the number of items. Size items by session: **one item = one fresh session**.

## Output level

The input type decides it (`labels`, else title prefix `[Epic]`/`[Feature]`/`[PBI]`/`[Bug]`, or the legacy `Epic: `/`Feature: `). Plan titles are summaries; the caller adds the level prefix:

| Input | Plan items |
|:--|:--|
| Epic | Features (`<capability>`, created as `[Feature] …`) |
| Feature | PBIs (`feat: …`, `fix: …`, created as `[PBI] …`) |
| PBI or bug | tasks (`chore: …`, created as `[Task] …`; one task needs no issue) |
| Description only | internal tasks |

## Steps

1. Resolve owner/repo from `git remote get-url origin` (SSH or HTTPS). Never ask the user.
2. Load `detect-techstack`; keep the JSON.
3. Read the input: `gh issue view <nr> --json title,body,labels`, or the description. Read ALL children, open and closed, with `gh api --paginate repos/{owner}/{repo}/issues/<nr>/sub_issues --jq '.[]|{number,state,title,labels:[.labels[].name]}'`; closed Tasks count as existing and are never re-planned ("Open vs. all tasks" in `github-issue` `references/task-issues.md`). Plan only what is missing; skip open Task issues already merged ("Task merged", same file) and list them in the return summary as `already merged: #<task> (<sha>)` for the caller to close.
4. Explore per the depth with a subagent per affected area, given the file budget and the question; keep only its ≤ 300-word summaries (Claude Code built-in `Explore` subagent, OpenCode `task`, VS Code Copilot `runSubagent`). Without subagents, explore inline with Read/Grep/Glob under the same budget.
5. Slice per `references/slicing.md`. Per item set `blocked_by`, `size` (S/M/L), `tier` (fast/standard/strong, see ## Tier) and `files`. Items whose files or exploration summary show background/async work, persistence or a state machine get an `## Invariants` section per `references/invariants.md` (load it only then).
6. Collect open decisions as `questions[]` per `references/questions.md`; resolve anything the repo can answer yourself.
7. Build the plan per `references/plan-schema.md`.

## Tier

Set `tier` per the table in `references/plan-schema.md`. Every item body carries one line `Tier: <tier> — <reason>`. Size L is `strong` unless split.

## Return

The plan JSON per `references/plan-schema.md`, then a summary of ≤ 10 lines: input type and level, item count by size, the first unblocked item, `already merged:` lines, open questions (id and one line each).

## Rules

- Titles are summaries without level prefix (Feature: the capability; PBI/Task: `feat: `, `chore: `, `fix: `); the caller prefixes them per the `github-issue` Issue Types; bodies are implementable without re-exploring: exact files and symbols, where tests go, what is out of scope.
- `blocked_by` forms a DAG over plan ids and existing issue numbers; no cycles, no self-reference.
- Never use markdown checklists for hierarchy; the caller uses native sub-issue and blocked-by links.
- The plan schema is the contract between planning and the caller.
