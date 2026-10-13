# Batch Workflow

Implements every child under one parent issue. Sequential only — later issues often assume earlier ones landed; never skip ahead on a red suite. Children are walked depth-first: Epic → Features → PBIs → Tasks, Feature → PBIs (→ Tasks), PBI → Tasks, Bug → Tasks.

## Exit condition per child

Re-read it before starting each issue; it is the literal definition of done:

- **Task** — Definition of Done (+ Implementation Notes)
- **PBI** — Acceptance Criteria + Definition of Done
- **Feature** — Definition of Done
- **Bug** — its Tasks must move toward **Expected Behavior**; a regression test is required before the PR

## Steps

1. **Discover** — `gh issue view <nr> --json title,body,labels`; list children with `gh api repos/{owner}/{repo}/issues/<nr>/sub_issues --jq '.[] | "\(.number) \(.title)"'` (see `sub-issues.md`), repeating per child that has children. Order: explicit notes in the parent body, then issues that unblock others, then ascending number. Record the full list first (Epics: TaskCreate/TodoWrite).
2. **Branch** — resolve the integration branch `<base>` once per `release-branches.md`. A Feature or Epic without a recorded release branch gets one first: `github-release cut --feature <nr>`. One branch per batch, `<type>/<nr>-<slug>` per `conventional-commits.md`: `git fetch origin <base>; git checkout -b <branch> origin/<base>`
3. **Per leaf issue, in order** — check its exit condition; delegate exploration to the `explorer` agent (issue text + exit condition in, ≤ 300 words of `path:line` findings out; see `standalone-issue.md` step 6 for the per-client call) and keep only its summary; load `implementation`; run the full build and tests until green; run `review-fanout` on the diff and fix blocking findings (`CHANGES_REQUESTED` with `incomplete: true` is not approval); commit only that issue's files (never `git add -A`): `<type>: <description> (#<N>)`; close it: `gh issue close <N> --comment "Implemented on <branch> at $(git rev-parse --short HEAD)."` (the native sub-issue link updates the parent's progress — no checklist). Exception: Tasks of a PBI run by the `orchestrator` are not closed or committed one by one with `Closes`; commits carry `Refs #<task>` and the PBI's PR closes the PBI (`task-issues.md`). An issue with children is closed after its children, once its own exit condition is verified.
4. **Wrap up** — verify the parent's Definition of Done. Close Features, then Epics, with a comment before the PR. Any other top-level parent is closed by the PR's `Closes #<nr>`, not manually.
5. **PR** — full build/lint/test from a clean state; `git push -u origin HEAD`; create with the `github-pull-request` skill (`base_branch: <base>`, `Closes #<nr>` for every parent completed, one summary line per child); merge with `gh pr merge <pr> --squash` into `<base>` only when the local verification passed (CI does not run on PRs into a release branch). The release itself is a separate step: `github-release finish`, only on request.

## Constraints

- One commit per leaf issue — history stays bisectable with green tests per commit
- Never close an issue whose exit condition did not actually pass; never merge on failing checks
- If criteria conflict between issues (e.g. a rename), implement in issue order and let the later commit do the rename
