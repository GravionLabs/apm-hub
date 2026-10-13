---
name: orch-pipeline
description: 'Orchestrated pipeline: plan → TDD per task → review fan-out → commit, with two approval gates. Use for "orchestrate" or "add feature end to end".'
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

Orchestrator. Modes by first word of input: `feature` (default), `fix`, `review` (only run `review-fanout`). Rest = issue number or description.

State lives in `.orch/<slug>/` (add to `.git/info/exclude`): `tasks.json` `[{id,title,status}]`, `review.json`; for a PBI the plan is `.agents/<pbi>/plan.json`, a local cache of the Task issue numbers (issues are the truth; a plan change edits the Task issue). Phases read these files, not chat history.

## Phases

1. **Plan** — load `detect-techstack`. Issue number → `gh issue view <nr> --json title,body,labels`; if not already on a feature branch, create `<type>/<nr>-<slug>` (naming per the `github-issue` skill's conventional-commits reference) from the integration branch resolved per its release-branches reference, never from `main`. A PBI or bug (PBI-like: Task children via `Parent Bug: #<bug>`, same task flow) without Task sub-issues → run `issue-planning` (PBI → tasks) and read `.agents/<issue>/plan.json`; existing Task sub-issues (label `task`) are used as they are; implement mode on a PBI without them plans first. One task: no Task issue. ≥ 2 tasks: `[Task]` sub-issues (`github-issue` `references/task-issues.md`) are created at GATE 1 with the approval. Without an issue, write ≤5 independently testable tasks to `tasks.json`; Feature or Epic input → plan, stop (then `orchestrator next <feature>` or `github-issue`). For `fix`, the first task is a failing reproduction test.
   **GATE 1:** show tasks, wait for approval.
2. **TDD per task** — in blocking order on the PBI's one branch; record `BASE=$(git rev-parse HEAD)` per task, write `.agents/<pbi>/task-<nr>-report.md`, add the ledger line `Task #<nr>: <status> — <sha>`; commit here: subject `<type>: <desc> (#<pbi>)`, footer `Refs #<task>` (single task: `Refs #<pbi>`), never `Closes`. Resume: with a ledger skip tasks whose line is `Task #<nr>: DONE`, cross-checked with `git log -E --grep "^Refs #<task>$" origin/<integration-branch>..HEAD` (no duplicate task commits); without a ledger a task is done when that grep finds a commit, and `<first BASE>` is `git merge-base HEAD origin/<integration-branch>`. Task sub-issues never get their own branch or PR. Single task without issue: report `task-<plan id>-report.md`. Details: `github-issue` `references/task-issues.md`. Load `implementation`, `<lang>-implementation`, `<lang>-test` (not installed → "install `<stack>@apm-hub`", continue with `implementation`). RED (failing test for the right reason) → GREEN (minimal code) → refactor → `verify-project`. Red? Fix, max 2 retries, then stop and report.
3. **Review** — one `review-fanout` on `<first BASE>..HEAD` after the last task. `CHANGES_REQUESTED` → fix blocking findings via TDD, re-review, max 2 rounds. `incomplete: true` is never approval.
4. **Finish** — **GATE 2:** show verdict + `git diff --stat`, ask. Task commits already exist (phase 2); approved → at most a final fix commit `<type>: <desc> (#<nr>)`. Without an issue (`tasks.json`), commit per task as `<type>: <desc>`. PR only on request, via `github-pull-request`: one per PBI, `Closes #<pbi>` and the task list `#<task> — <sha>` (single task: `#<pbi> — <sha>`).

## Output (JSON per phase)

`{"phase":"<phase>","status":"ok|fail|gate","summary":"≤120 chars"}`

## Rules
- No code without tests. Gates never auto-approve.
- Fail closed: unverifiable or incomplete = not approved.
