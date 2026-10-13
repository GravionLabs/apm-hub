# Orchestrator: issue overview and review summary

Two default outputs of the `orchestrator` agent, each switched off by a flag in the first message (`orchestrator --no-overview full`, `/orchestrator --no-review-summary full 123`, `/orch --no-review-summary fix 123`). Flags are removed from the message before the mode word is read.

## Issue overview (default only without an issue number; `--no-overview` skips it)

Runs only when the first message has no issue number and no description (empty, or a bare mode word). Skipped when a number or a description is given (`/orch feature|fix <description>` goes to `tasks.json` as usual).

1. Resolve the integration branch per `release-branches.md`.
2. List open issues that target it: `gh issue list --state open --limit 100 --json number,title,labels`, keep those whose branch/milestone/parent chain belongs to the integration branch (a release branch: its milestone or the issues referenced by its commits; no release branch: all open issues).
3. Type from label or title prefix (`[Epic]`, `[Feature]`, `[PBI]`, `[Task]`). Status: `merged` when the "Task merged" rule in `task-issues.md` finds the commit on `origin/<integration-branch>` (reference it, do not restate it; such issues are shown as merged, never offered), `in progress` when a branch `*/<nr>-*` or a ledger `.agents/<nr>/progress.md` exists, otherwise `open`.
4. Show one line per issue, `#<nr> <type> <status> <title>`, Epics first. Ask which issue to run (and the mode if none was given); the answer becomes `<issue>`. Headless: create `.agents/overview.md` (add `.agents/` to `.git/info/exclude` when not ignored; no `.agents/<issue>/` exists yet), append `Gate: Which issue? <overview>` and stop. Keep at most 300 words of it.

## Review summary (default after `review-fanout`; `--no-review-summary` skips it)

First line: `Review mode: <mode> (<dimensions>)` from the `mode` and `dimensions` of the `review-fanout` output; the user can ask to re-run with `full`. Then show one line per finding of `blocking` and `advisory`, `severity file:line issue`, grouped by severity (CRITICAL, HIGH, then MEDIUM, LOW), blocking first, MEDIUM and LOW included. Then ask which advisory findings to fix. Selected advisories join the blocking ones in the fix round; the rest go into the PR body. No advisory findings: no question. Verdict `APPROVE` with advisories still shows the summary and asks; selected advisories go through a fix round followed by a re-review, unselected ones to the PR body. `incomplete: true` stays blocking and is not an advisory choice.

With `--no-review-summary` only blocking findings trigger fix rounds and all advisories go to the PR body.

Headless (no question tool): append `Gate: <question>` to the ledger, report it and stop.

## Clear before implement (closing line after a plan)

Why: after an idle gap the prompt cache is rewritten, and that cost grows with the context. Planning (exploration, grilling, `AskUserQuestion`) fills it; the implement run needs only `.agents/<issue>/plan.json` and the Task issues.

- `plan` mode: the closing line of the report is `Next: /clear, then orchestrator implement <issue>`. Always, no threshold.
- `full` mode: after the plan is approved, when the session context is above 100k tokens (`/context`, or the `hooks` warning already fired), ask once whether to stop here and continue with `/clear` then `orchestrator implement <issue>`; below 100k continue without asking. Headless: continue.
- Never clear for the user; the recommendation is the whole gate. Not shown for `implement` or `next` runs.
