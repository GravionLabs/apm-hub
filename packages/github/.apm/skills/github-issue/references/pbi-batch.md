# PBI / Batch Workflow

Implements all Tasks under a single PBI. Each Task becomes one commit. A single PR at the end
closes the PBI.

Sequential workflow — do not parallelize Task implementation.

## Phase 1 — Discover scope

1. Read the PBI: `gh issue view <pbi-nr> --json title,body,labels`
2. List the PBI's Task children: `gh api repos/{owner}/{repo}/issues/<pbi-nr>/sub_issues --jq '.[] | "\(.number) \(.title)"'` (see `sub-issues.md`)
3. Fetch every Task: `gh issue view <nr> --json title,body`
4. Determine implementation order (ascending issue number unless the PBI body specifies otherwise)
5. Record the ordered list before writing any code

## Phase 2 — Branch

6. `git fetch origin main && git checkout -b feature/<pbi-nr>-<slug> origin/main`
   (use `bugfix/` if the PBI is a child of a Bug)

## Phase 3 — Task loop (repeat for every Task, in order)

For each Task `#N`:

7. Re-read `#N`'s **Definition of Done** and **Implementation Notes**
8. Load the `implementation` skill for code/test conventions
9. Run the full build + test suite. Iterate until green. Do not move on with a red suite
10. Commit:
    ```bash
    git add <specific files>
    git commit -m "<type>: <description> (#<N>)"
    ```
    Use the conventional-commit type that matches the Task title prefix (`chore`, `feat`, `fix`, `test`, …)
11. Close the Task:
    ```bash
    gh issue close <N> --comment "Implemented on <branch-name> at $(git rev-parse --short HEAD)."
    ```
12. Nothing to tick — the native sub-issue link updates the PBI's progress automatically

## Phase 4 — PBI wrap-up

13. Verify all **Acceptance Criteria** in the PBI are met and **Definition of Done** is satisfied
14. Close the PBI:
    ```bash
    gh issue close <pbi-nr> --comment "All tasks implemented. PR pending."
    ```

## Phase 5 — PR + merge

15. Run the full build/lint/test suite one more time
16. `git push -u origin HEAD`
17. Create PR:
    ```bash
    gh pr create --title "<type>: <description> (#<pbi-nr>)" --body "$(cat <<-BODY
    ## Summary
    <one line per task>

    ## Testing
    - [ ] Unit tests pass

    Closes #<pbi-nr>
    BODY
    )"
    ```
18. Watch CI: `gh pr checks <pr-number> --watch`
19. Merge once green using the repo's usual strategy

## Constraints

- One branch per PBI; one commit per Task
- Never close a Task whose Definition of Done did not pass
- Never merge a PR with failing checks
