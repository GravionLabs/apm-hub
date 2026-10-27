---
name: issue-planning
description: 'Plan an issue one level down with blockers and sizes; writes plan.json. Use for "plan issue #N".'
---

Planning only: no source edits, no issue creation, no questions to the user (the primary agent grills them per `references/grilling.md`). The executing agent needs write access to `<state>/<issue>/` only (`<state>` = `state_dir` of `detect-techstack`). Creating issues is `references/publish.md`, run by the primary agent after the grilling rounds and approval.

## Depth (exploration budget)

Pick from the request ("quick plan", "deep planning") or default to **standard**.

| Depth    | Exploration                                                     |
|----------|-----------------------------------------------------------------|
| quick    | ~5 key files                                                    |
| standard | Grep/glob/read affected and related code                        |
| deep     | Standard + call sites, tests, docs of every affected area       |

Depth limits exploration, not the number of items. Size items by session: **one item = one fresh session**.

## Output level

The input type decides it (`labels`, else title prefix `[Epic]`/`[Feature]`/`[PBI]`/`[Bug]`, or the legacy `Epic: `/`Feature: `). Plan titles are summaries; publish adds the level prefix:

| Input | Plan items | GitHub issues |
|:--|:--|:--|
| Epic | Features (`<capability>`, published as `[Feature] …`) | yes, at publish |
| Feature | PBIs (`feat: …`, `fix: …`, published as `[PBI] …`) | yes, at publish |
| PBI or bug | tasks (`chore: …`, published as `[Task] …`) | only for ≥ 2 tasks: `[Task]` sub-issues at publish; one task stays in the plan file |
| Description only | internal tasks | no (the orchestrator creates the PBI at the gate, then Task issues as for a PBI) |

## Steps

1. Resolve owner/repo from `git remote get-url origin` (SSH or HTTPS). Never ask the user.
2. Load `detect-techstack`; keep the JSON.
3. Read the input: `gh issue view <nr> --json title,body,labels`, or the description. Read ALL children, open and closed, with `gh api --paginate repos/{owner}/{repo}/issues/<nr>/sub_issues --jq '.[]|{number,state,title,labels:[.labels[].name]}'`; closed Tasks count as existing and are never re-planned ("Open vs. all tasks" in `github-issue` `references/task-issues.md`). Plan only what is missing; skip open Task issues already merged ("Task merged", same file) and close them.
4. Explore per the depth through the `explorer` agent: one call per affected area with the file budget and the question; keep only its ≤ 300-word summaries (Claude Code `Agent` with `subagent_type: explorer`, OpenCode `task`, VS Code Copilot `runSubagent`). A runner that cannot spawn agents (a subagent) explores inline with Read/Grep/Glob under the same budget; dispatching `explorer` is then the caller's job.
5. Slice per `references/slicing.md`. Per item set `blocked_by`, `size` (S/M/L), `tier` (fast/standard/strong, see ## Tier) and `files`. Items whose files or exploration summary show background/async work, persistence or a state machine get an `## Invariants` section per `references/invariants.md` (load it only then).
6. Collect open decisions as `questions[]`. Answers given in the prompt are final: keep those questions removed and plan accordingly. Resolve anything the repo can answer yourself; keep only real choices (product, scope, risk) with options, a `recommended` option and the item ids it `blocks`.
7. Write `<state>/<issue>/plan.json` (schema: `references/plan-schema.md`) and `plan.md` (human view: table of items, blocker order, questions). Create the directory; use `<state>/adhoc/` without an issue number.

## Tier

Set `tier` per `references/model-policy.md` in the `github-issue` skill (attributes to tier, tier to model id per client). Every item body carries one line `Tier: <tier> — <reason>`. Size L is `strong` unless split.

## Return

Only the plan path and a summary of ≤ 10 lines: input type and level, item count by size, the first unblocked item, open questions (id and one line each). No JSON or item bodies in the reply.

## Rules

- Titles are summaries without level prefix (Feature: the capability; PBI/Task: `feat: `, `chore: `, `fix: `); publish prefixes them per the `github-issue` Issue Types; bodies are implementable without re-exploring: exact files and symbols, where tests go, what is out of scope.
- `blocked_by` forms a DAG over plan ids and existing issue numbers; no cycles, no self-reference.
- Never use markdown checklists for hierarchy; publish uses native sub-issue and blocked-by links.
- `plan.json` is the contract between planning and the primary agent; `github-issue` references it for publishing.
