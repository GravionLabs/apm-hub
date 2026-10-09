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
2. **Branch** — resolve the default branch once (`git symbolic-ref refs/remotes/origin/HEAD --short` minus `origin/`, fallback `main`; `<default>` below). One branch per batch, `<type>/<nr>-<slug>` per `conventional-commits.md`: `git fetch origin <default>; git checkout -b <branch> origin/<default>`
3. **Per leaf issue, in order** — check its exit condition; load `implementation`; run the full build and tests until green; run `review-fanout` on the diff and fix blocking findings (`CHANGES_REQUESTED` with `incomplete: true` is not approval); commit only that issue's files (never `git add -A`): `<type>: <description> (#<N>)`; close it: `gh issue close <N> --comment "Implemented on <branch> at $(git rev-parse --short HEAD)."` (the native sub-issue link updates the parent's progress — no checklist). An issue with children is closed after its children, once its own exit condition is verified.
4. **Wrap up** — verify the parent's Definition of Done. Close Features, then Epics, with a comment before the PR. Any other top-level parent is closed by the PR's `Closes #<nr>`, not manually.
5. **PR** — full build/lint/test from a clean state; `git push -u origin HEAD`; create with the `github-pull-request` skill (`Closes #<nr>` for every parent completed, one summary line per child); `gh pr checks <pr> --watch`; merge only when green, using the repo's usual strategy (`gh pr list --state merged --limit 5` if unsure)

## Constraints

- One commit per leaf issue — history stays bisectable with green tests per commit
- Never close an issue whose exit condition did not actually pass; never merge on failing checks
- If criteria conflict between issues (e.g. a rename), implement in issue order and let the later commit do the rename
