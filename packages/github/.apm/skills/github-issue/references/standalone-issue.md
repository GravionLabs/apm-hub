# Standalone Issue Workflow

Full lifecycle for a single issue without sub-tasks: read → branch → implement → verify → PR.

## Phase 1 — Read + Branch

1. Read issue: `gh issue view <nr> --json title,body,labels`
2. Derive branch type from labels (feature/bugfix/hotfix/chore)
3. Create branch: `git fetch origin main && git checkout -b <type>/<nr>-<slug> origin/main`

## Phase 2 — Implement

4. Explore codebase, affected areas
5. Break issue into implementation tasks
6. Write code + tests per project conventions (load the `implementation` skill or its language sub-skill)
7. Atomic commits per the conventional-commits reference

## Phase 3 — Verify + PR

8. Run full build + test suite (load `detect-techstack` if commands are unknown). Fix failures.
9. Review diff: `git diff main...HEAD` — no debug code, TODOs, missing tests
10. Push: `git push -u origin HEAD`
11. Create PR:
    ```bash
    gh pr create --title "<type>: <desc> (#<nr>)" --body "$(cat)" <<-BODY
    ## Summary

    ## Changes

    ## Testing
    - [ ] Unit tests pass

    Closes #<nr>
    BODY
    ```
12. Confirm: `gh pr view --json number,url`

## Constraints

- All CI checks green before review
- If asked to also merge: `gh pr checks <nr> --watch`, then merge with the repo's usual strategy once green
