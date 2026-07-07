# Epic / Batch Workflow

Batch version of the single-issue lifecycle. Input is one or more epic issues, each linking sub-issues
(`- [ ] #N` checklist in the epic body). Output is one feature branch containing one commit per completed
sub-issue, with every sub-issue closed on GitHub as its commit lands, and a single PR at the end that gets merged
once CI/build is green.

This is a long-running, sequential workflow — do not parallelize sub-issue implementation (later issues often
assume earlier ones already landed) and do not skip ahead if a sub-issue's tests fail.

## Phase 1 — Discover scope

1. List target epics and read each: `gh issue view <epic-nr> --json title,body,labels`
2. Extract the sub-issue numbers from each epic's checklist (`- [ ] #N`)
3. Fetch every sub-issue body: `gh issue view <nr> --json title,body`
4. Determine an implementation order:
   - Respect explicit ordering notes in an epic body (e.g. "do #13 first, the rest copy its pattern")
   - Put epics that unbreak the codebase or the test suite first — later epics assume the test suite is green
     and collecting the full tree
   - Otherwise keep ascending issue number order within an epic, and epic order as given by the user
5. Record the full ordered list before writing any code — use TaskCreate/TodoWrite so progress survives context
   compaction across a long run.

## Phase 2 — Branch

6. `git fetch origin main && git checkout -b <branch-name> origin/main`
   (e.g. `epics/25-29-cleanup-and-indicators` — descriptive, not tied to a single issue number since it spans many)

## Phase 3 — Sub-issue loop (repeat for every sub-issue, in order)

For each sub-issue `#N`:

7. Re-read `#N`'s acceptance criteria and "Verify" command from its body — these are the literal exit condition
   for the issue, not a suggestion.
8. Implement the change. Load the `implementation` skill (or its language sub-skill) for code/test conventions.
   Keep the diff scoped to what `#N` asks for — don't opportunistically fix other sub-issues early, even if you
   notice the problem while in the file (do it on that issue's turn instead, so the commit history stays
   one-issue-per-commit and closing issues stays accurate).
9. Run the issue's own "Verify" command, then the full suite (load `detect-techstack` if the project's commands
   are unknown). Iterate until green. Do not move on with a red suite.
10. Commit only the files that change belongs to:
    ```
    git add <specific files>
    git commit -m "<type>: <description> (#<N>)"
    ```
    Use a conventional-commit type matching the issue's own label (see the conventional-commits reference).
11. Close the sub-issue with a reference back to the branch/commit, e.g.:
    ```
    gh issue close <N> --comment "Implemented on <branch-name> at $(git rev-parse --short HEAD)."
    ```
12. Move to the next sub-issue. If a sub-issue turns out to already be satisfied (e.g. a later fix made it moot),
    say so explicitly, still close it with a comment explaining why, and don't fabricate a commit for it.

## Phase 4 — Epic wrap-up

13. Once every sub-issue under an epic is closed, the epic issue can be closed too (checklist auto-closes on
    GitHub when linked issues close; verify with `gh issue view <epic-nr>` and close manually if it didn't).

## Phase 5 — PR + merge (only after every sub-issue across every epic is done)

14. Run the full build/lint/test suite one more time from a clean state.
15. `git push -u origin HEAD`
16. Open the PR referencing every epic/sub-issue closed:
    ```
    gh pr create --title "<summary of the batch>" --body "$(cat <<-BODY
    ## Summary
    <one line per epic>

    Closes #<epic1>, #<epic2>, ...

    BODY
    )"
    ```
17. Watch CI: `gh pr checks <pr-number> --watch` (or re-run the local build/test suite if the repo has no CI).
18. If checks pass, merge: `gh pr merge <pr-number> --squash` (or the repo's usual merge strategy — check recent
    merged PRs with `gh pr list --state merged --limit 5` if unsure). If checks fail, fix on the branch, push,
    re-verify, then merge — do not merge red.

## Constraints

- One feature branch for the whole batch; one commit per sub-issue (not per epic, not squashed until the final
  PR merge).
- Never batch-commit multiple sub-issues together, even if they touch the same file — the point of this workflow
  is a bisectable history where each commit's tests passed standalone.
- Never close a sub-issue whose verify step didn't actually pass.
- Never merge the final PR on a red build.
- If a sub-issue's acceptance criteria conflict with a later sub-issue's (e.g. later one renames what an earlier
  one added), implement in issue order and let the later issue's commit do the rename — don't pre-empt it.
