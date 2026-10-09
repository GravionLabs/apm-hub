# Standalone Issue Workflow

Full lifecycle for a single issue without sub-tasks: read → branch → implement → verify → PR.

Applies to: **Task**, **PBI** (no tasks), **Bug** (no tasks), **Feature** (no PBIs).

## Phase 1 — Read + Branch

1. Read issue: `gh issue view <nr> --json title,body,labels`
2. Derive the branch name `<type>/<nr>-<slug>` per `conventional-commits.md` (type from the issue title)
3. Create branch: `git fetch origin main && git checkout -b <branch> origin/main`
4. Note the parent from the body's first line (`Parent Epic: #N` / `Parent Feature: #N` / `Parent PBI: #N`), if present. Closing this issue updates the parent's progress automatically via its native sub-issue link — there is nothing to tick afterwards.

## Phase 2 — Implement

5. Identify "done" from the issue's type-specific sections:
   - **PBI**: Acceptance Criteria + Definition of Done
   - **Task**: Definition of Done (+ Implementation Notes)
   - **Bug**: Expected Behavior must be restored; Definition of Done requires a regression test
   - **Feature**: Definition of Done (scope)
6. Explore codebase, identify affected areas
7. Write code + tests per project conventions (load the `implementation` skill or its language sub-skill)
8. Atomic commits per the conventional-commits reference

## Phase 3 — Verify + PR

9. Run full build + test suite (load `detect-techstack` if commands are unknown). Fix failures.
10. Review diff: `git diff main...HEAD` — no debug code, TODOs, missing tests
11. Push: `git push -u origin HEAD`
12. Create the PR with the `github-pull-request` skill (title `<type>: <desc> (#<nr>)`, body ends with `Closes #<nr>`)
13. If the issue has a parent: confirm it is actually linked as a native sub-issue —
    `gh api repos/{owner}/{repo}/issues/<parent-nr>/sub_issues --jq '.[].number'` should include `<nr>`.
    If it is missing, link it per `sub-issues.md`. An unlinked child looks normal in `gh issue list`,
    so this check is the only thing that catches it.

## Constraints

- All CI checks green before review
- Bug issues require a regression test in the PR — do not close without one
- If asked to also merge: `gh pr checks <nr> --watch`, then merge with the repo's usual strategy once green
