# Bug / Batch Workflow

Implements all Tasks under a single Bug. Each Task becomes one commit. A single PR at the end
closes the Bug. Mirrors `pbi-batch.md` but scoped to the Bug issue sections.

Sequential workflow — do not parallelize Task implementation.

## Phase 1 — Discover scope

1. Read the Bug: `gh issue view <bug-nr> --json title,body,labels`
2. Extract Task numbers from the `## Sub-Issues` checklist (`- [ ] #N`)
3. Fetch every Task: `gh issue view <nr> --json title,body`
4. Note the Bug's **Expected Behavior** — every Task must move the system closer to that state
5. Determine implementation order (ascending issue number unless the Bug body specifies otherwise)
6. Record the ordered list before writing any code

## Phase 2 — Branch

7. `git fetch origin main && git checkout -b bugfix/<bug-nr>-<slug> origin/main`

## Phase 3 — Task loop (repeat for every Task, in order)

For each Task `#N`:

8. Re-read `#N`'s **Definition of Done** and **Implementation Notes**
9. Cross-reference the Bug's **Expected Behavior** to confirm the task moves toward a fix
10. Load the `implementation` skill for code/test conventions
11. Run the full build + test suite (including any regression test added so far). Iterate until green.
    Do not move on with a red suite
12. Commit:
    ```bash
    git add <specific files>
    git commit -m "<type>: <description> (#<N>)"
    ```
13. Close the Task:
    ```bash
    gh issue close <N> --comment "Implemented on <branch-name> at $(git rev-parse --short HEAD)."
    ```
14. Mark `#N`'s line in the Bug's `## Sub-Issues` checklist (`- [ ] #N` → `- [x] #N`)

## Phase 4 — Bug wrap-up

15. Verify the Bug's **Definition of Done**: the fix is in, a regression test exists, and the Actual
    Behavior now matches the Expected Behavior
16. The Bug will be closed via `Closes #<bug-nr>` in the PR — do not close it manually

## Phase 5 — PR + merge

17. Run the full build/lint/test suite one more time
18. `git push -u origin HEAD`
19. Create PR:
    ```bash
    gh pr create --title "fix: <symptom> (#<bug-nr>)" --body "$(cat <<-BODY
    ## Summary
    <what was broken and what was fixed>

    ## Testing
    - [ ] Regression test added

    Closes #<bug-nr>
    BODY
    )"
    ```
20. Watch CI: `gh pr checks <pr-number> --watch`
21. Merge once green using the repo's usual strategy

## Constraints

- One `bugfix/` branch per Bug; one commit per Task
- Bug Definition of Done requires a regression test — do not merge without one
- Never close a Task whose Definition of Done did not pass
- Never merge a PR with failing checks
