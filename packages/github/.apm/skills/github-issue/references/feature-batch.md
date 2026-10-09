# Feature / Batch Workflow

Implements all PBIs under a single Feature. Each PBI becomes one commit (or a group of commits if
the PBI itself has Task sub-issues — see `pbi-batch.md`). A single PR at the end closes the Feature.

Sequential workflow — do not parallelize PBI implementation and do not skip ahead on a red suite.

## Phase 1 — Discover scope

1. Read the Feature: `gh issue view <feature-nr> --json title,body,labels`
2. List the Feature's PBI children: `gh api repos/{owner}/{repo}/issues/<feature-nr>/sub_issues --jq '.[] | "\(.number) \(.title)"'` (see `sub-issues.md`)
3. Fetch every PBI: `gh issue view <nr> --json title,body,labels`
4. For each PBI, check whether it has Task children of its own — note which ones do
5. Determine implementation order:
   - Respect explicit ordering notes in the Feature body
   - PBIs that unblock others go first; otherwise ascending issue number order
6. Record the full ordered list before writing any code

## Phase 2 — Branch

7. `git fetch origin main && git checkout -b feature/<feature-nr>-<slug> origin/main`

## Phase 3 — PBI loop (repeat for every PBI, in order)

For each PBI `#N`:

8. Re-read `#N`'s **Acceptance Criteria** and **Definition of Done** — these are the literal exit conditions
9. If `#N` has Task sub-issues: apply `references/pbi-batch.md` logic (one commit per Task);
   otherwise implement `#N` as a single commit
10. Load the `implementation` skill for code/test conventions
11. Run the full build + test suite after every commit. Iterate until green. Do not move on with a red suite
12. Commit (if implementing as a single unit):
    ```bash
    git add <specific files>
    git commit -m "<type>: <description> (#<N>)"
    ```
    Use the conventional-commit type that matches the PBI title prefix (`feat`, `refactor`, `docs`, `test`, …)
13. Close the PBI:
    ```bash
    gh issue close <N> --comment "Implemented on <branch-name> at $(git rev-parse --short HEAD)."
    ```
14. Nothing to tick — the native sub-issue link updates the Feature's progress automatically

## Phase 4 — Feature wrap-up

15. Verify the Feature's **Definition of Done** is fully met
16. Close the Feature:
    ```bash
    gh issue close <feature-nr> --comment "All PBIs implemented. PR pending."
    ```

## Phase 5 — PR + merge

17. Run the full build/lint/test suite one more time
18. `git push -u origin HEAD`
19. Create PR:
    ```bash
    gh pr create --title "Feature: <name> (#<feature-nr>)" --body "$(cat <<-BODY
    ## Summary
    <one line per PBI>

    Closes #<feature-nr>
    BODY
    )"
    ```
20. Watch CI: `gh pr checks <pr-number> --watch`
21. Merge once green using the repo's usual strategy (`gh pr list --state merged --limit 5` if unsure)

## Constraints

- One `feature/` branch per Feature; one commit per PBI (or per Task if the PBI uses pbi-batch logic)
- Never close a PBI whose Acceptance Criteria did not pass
- Never merge a PR with failing checks
- If a PBI's criteria conflict with a later PBI's (e.g. a rename), implement in issue order
