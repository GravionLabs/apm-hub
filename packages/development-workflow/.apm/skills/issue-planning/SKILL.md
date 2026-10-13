---
name: issue-planning
description: 'Plan an issue one level down with blockers and sizes; writes plan.json. Use for "plan issue #N".'
---

Planning only: read-only, no questions to the user, no issue creation. A read-only planner subagent can run it. Creating issues is `references/publish.md`, run by the primary agent after approval.

## Depth (exploration budget)

Pick from the request ("quick plan", "deep planning") or default to **standard**.

| Depth    | Exploration                                                     |
|----------|-----------------------------------------------------------------|
| quick    | ~5 key files                                                    |
| standard | Grep/glob/read affected and related code                        |
| deep     | Standard + call sites, tests, docs of every affected area       |

Depth limits exploration, not the number of items. Size items by session: **one item = one fresh session**.

## Output level

The input type decides it (`labels`, else title prefix):

| Input | Plan items | GitHub issues |
|:--|:--|:--|
| Epic | Features (`Feature: …`) | yes, at publish |
| Feature | PBIs (`feat: …`, `fix: …`) | yes, at publish |
| PBI or bug | internal tasks (`chore: …`) | no, tasks stay in the plan file |
| Description only | internal tasks | no |

## Steps

1. Resolve owner/repo from `git remote get-url origin` (SSH or HTTPS). Never ask the user.
2. Load `detect-techstack`; keep the JSON.
3. Read the input: `gh issue view <nr> --json title,body,labels`, or the description. Read existing children with `gh api repos/{owner}/{repo}/issues/<nr>/sub_issues` and plan only what is missing.
4. Explore per the depth through the `explorer` agent: one call per affected area with the file budget and the question; keep only its ≤ 300-word summaries (Claude Code `Agent` with `subagent_type: explorer`, OpenCode `task`, VS Code Copilot `runSubagent`; inline with the same budget without agents).
5. Slice per `references/slicing.md`. Per item set `blocked_by`, `size` (S/M/L), `model` (haiku/sonnet/inherit, rule below) and `files`.
6. Collect open decisions as `questions[]`. Resolve anything the repo can answer yourself; keep only real choices (product, scope, risk) with options, a `recommended` option and the item ids it `blocks`.
7. Write `.agents/<issue>/plan.json` (schema: `references/plan-schema.md`) and `plan.md` (human view: table of items, blocker order, questions). Create the directory; use `.agents/adhoc/` without an issue number.

## Model hint

Same rule as the `orchestrator` agent: `haiku` only for mechanical edits; `sonnet` is the floor for prose-only and routine implementation; `inherit` (or stronger) for integration, design and cross-cutting items. Size L is `inherit` unless split.

## Return

Only the plan path and a summary of ≤ 10 lines: input type and level, item count by size, the first unblocked item, open questions (id and one line each). No JSON or item bodies in the reply.

## Rules

- Titles are conventional per the github-issue convention (`Feature: `, `feat: `, `chore: `, `fix: `); bodies are implementable without re-exploring: exact files and symbols, where tests go, what is out of scope.
- `blocked_by` forms a DAG over plan ids and existing issue numbers; no cycles, no self-reference.
- Never use markdown checklists for hierarchy; publish uses native sub-issue and blocked-by links.
- `plan.json` is the contract read by `orch-pipeline`, `github-issue` and the orchestrator.
