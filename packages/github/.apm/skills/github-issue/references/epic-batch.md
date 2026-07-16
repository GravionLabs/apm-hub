# Epic / Batch Workflow

Implements all Features (and their PBIs) under one or more Epic issues. An Epic's sub-issues are
Features (`feature` label); each Feature's sub-issues are PBIs (`pbi` label); each PBI may have
Tasks (`task` label). This workflow walks the full tree.

This is a sequential workflow — do not parallelize Feature/PBI implementation (later issues often
assume earlier ones already landed) and do not skip ahead if any suite fails.

## Phase 1 — Discover scope

1. Read each Epic: `gh issue view <epic-nr> --json title,body,labels`
2. Extract Feature numbers from the `## Sub-Issues` checklist (`- [ ] #N`)
3. For each Feature, read its body and extract its PBI sub-issues; for each PBI, check for Task sub-issues
4. Determine implementation order:
   - Respect explicit ordering notes in the Epic body (e.g. "do #13 first")
   - Put Features/PBIs that unblock others or fix the test suite first
   - Otherwise keep ascending issue number order within each level, and Epic order as given
5. Record the full ordered list (Epics → Features → PBIs → Tasks) before writing any code — use
   TaskCreate/TodoWrite so progress survives context compaction across a long run.

## Phase 2 — Branch

6. `git fetch origin main && git checkout -b <branch-name> origin/main`
   (e.g. `feature/epics-25-29-cleanup-and-indicators` — descriptive, spanning multiple issues)

## Phase 3 — Feature loop (repeat for every Feature, in order)

For each Feature `#F`:

7. Read `#F`'s **Definition of Done** — this is the exit condition for the Feature
8. Process each PBI under `#F` in order using `references/feature-batch.md` logic:
   - Each PBI's Acceptance Criteria are the literal exit conditions
   - PBIs with Task sub-issues are processed per `references/pbi-batch.md` logic
   - One commit per PBI (or per Task if the PBI delegates to tasks)
9. After all PBIs under `#F` are closed, close the Feature:
   ```bash
   gh issue close <F> --comment "All PBIs implemented on <branch-name>."
   ```
10. Mark `#F`'s line in the Epic's `## Sub-Issues` checklist (`- [ ] #F` → `- [x] #F`)

## Phase 4 — Epic wrap-up

11. Once every Feature under an Epic is closed, close the Epic:
    ```bash
    gh issue close <epic-nr> --comment "All Features implemented. PR pending."
    ```

## Phase 5 — PR + merge (only after every issue across every Epic is done)

12. Run the full build/lint/test suite one more time from a clean state.
13. `git push -u origin HEAD`
14. Open the PR referencing every Epic closed:
    ```bash
    gh pr create --title "<summary of the batch> (#<epic-nrs>)" --body "$(cat <<-BODY
    ## Summary
    <one line per epic>

    Closes #<epic1>, #<epic2>, ...

    BODY
    )"
    ```
15. Watch CI: `gh pr checks <pr-number> --watch` (or re-run local build/test if no CI).
16. Merge once green: check the repo's usual strategy with `gh pr list --state merged --limit 5`.
    If checks fail, fix on the branch, push, re-verify, then merge — do not merge red.

## Constraints

- One branch for the whole batch; one commit per PBI (or per Task if PBI uses pbi-batch logic).
- Never batch-commit multiple issues together — the history must be bisectable with green tests per commit.
- Never close an issue whose verify step didn't actually pass.
- Never merge the final PR on a red build.
- If an issue's acceptance criteria conflict with a later one's (e.g. a rename), implement in issue
  order and let the later commit do the rename — don't pre-empt it.
