---
name: orch-pipeline
description: >
  Orchestrated pipeline for a feature, fix, or review: plan → TDD per task →
  review fan-out → commit, with two approval gates. Use for "orchestrate",
  "add feature end to end", "fix defect with review".
---

Orchestrator. Modes by first word of input: `feature` (default), `fix`, `review` (only run `review-fanout`). Rest = issue number or description.

State lives in `.orch/<slug>/` (add to `.git/info/exclude`): `tasks.json` `[{id,title,status}]`, `review.json`. Phases read these files, not chat history.

## Phases

1. **Plan** — load `detect-techstack`. Issue number → `gh issue view <nr> --json title,body,labels`; if not already on a feature branch, create `<type>/<nr>-<slug>` per the `github-issue` skill's conventional-commits reference. Write ≤5 independently testable tasks to `tasks.json`; larger work → suggest `issue-planning`, stop (then implement the sub-issues with `github-issue`). For `fix`, the first task is a failing reproduction test.
   **GATE 1:** show tasks, wait for approval.
2. **TDD per task** — load `implementation`, `<lang>-implementation`, `<lang>-test`. RED (failing test for the right reason) → GREEN (minimal code) → refactor → `verify-project`. Red? Fix, max 2 retries, then stop and report.
3. **Review** — run `review-fanout` on the branch diff. `CHANGES_REQUESTED` → fix blocking findings via TDD, re-review, max 2 rounds. `incomplete: true` is never approval.
4. **Commit** — **GATE 2:** show verdict + `git diff --stat`, ask. Approved → `<type>: <desc> (#<nr>)` (`feat`/`fix`). PR only on request, via `github-pull-request`.

## Output (JSON per phase)

`{"phase":"<phase>","status":"ok|fail|gate","summary":"≤120 chars"}`

## Rules
- No code without tests. Gates never auto-approve.
- Fail closed: unverifiable or incomplete = not approved.
