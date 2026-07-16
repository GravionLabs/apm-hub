# Standalone Issue Workflow

Full lifecycle for a single issue without sub-tasks: read → branch → implement → verify → PR.

Applies to: **Task**, **PBI** (no tasks), **Bug** (no tasks), **Feature** (no PBIs).

## Phase 1 — Read + Branch

1. Read issue: `gh issue view <nr> --json title,body,labels`
2. Derive branch name from the issue type and label:
   - `feature` label → `feature/<nr>-<slug>`
   - `pbi` label → `feature/<nr>-<slug>`
   - `bug` label → `bugfix/<nr>-<slug>`
   - `task` label (chore/maintenance) → `chore/<nr>-<slug>`
   - `task` label (feat/fix) → `feature/<nr>-<slug>` or `bugfix/<nr>-<slug>` as appropriate
3. Create branch: `git fetch origin main && git checkout -b <branch> origin/main`
4. Note the `Part of #NNN` parent reference (if present) — you'll update the parent's checklist after closing.

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
12. Create PR:
    ```bash
    gh pr create --title "<type>: <desc> (#<nr>)" --body "$(cat <<-BODY
    ## Summary

    ## Changes

    ## Testing
    - [ ] Unit tests pass

    Closes #<nr>
    BODY
    )"
    ```
13. Confirm: `gh pr view --json number,url`
14. If the issue has a `Part of #NNN` parent: after the PR merges, update the parent's `## Sub-Issues` checklist
    (`- [ ] #<nr>` → `- [x] #<nr>`) and verify via `gh issue view <parent-nr>`.

## Constraints

- All CI checks green before review
- Bug issues require a regression test in the PR — do not close without one
- If asked to also merge: `gh pr checks <nr> --watch`, then merge with the repo's usual strategy once green
