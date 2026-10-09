# Batch Workflow

Implements every child under one parent issue. Sequential only — later issues often assume earlier ones landed; never skip ahead on a red suite. Pick the row for the parent's type:

| Parent | Children (recurse down) | Branch | Child exit condition | PR title | Extra |
|---|---|---|---|---|---|
| epic | Features → PBIs → Tasks | `feature/epics-<nrs>-<slug>` (one branch for all given epics) | Feature **Definition of Done** | `<batch summary> (#<epic-nrs>)` | Track the ordered list with TaskCreate/TodoWrite; close each Feature, then the Epic, before the PR |
| feature | PBIs (→ Tasks) | `feature/<nr>-<slug>` | PBI **Acceptance Criteria** + DoD | `feat: <name> (#<nr>)` | PBIs with Tasks use the pbi row |
| pbi | Tasks | `feature/<nr>-<slug>` (`bugfix/` if the PBI is under a Bug) | Task **Definition of Done** + Implementation Notes | `<type>: <desc> (#<nr>)` | |
| bug | Tasks | `bugfix/<nr>-<slug>` | Task DoD; each Task moves toward the Bug's **Expected Behavior** | `fix: <symptom> (#<nr>)` | A regression test is required before the PR |

## 1. Discover

1. Read the parent: `gh issue view <nr> --json title,body,labels`
2. List children (see `sub-issues.md`): `gh api repos/{owner}/{repo}/issues/<nr>/sub_issues --jq '.[] | "\(.number) \(.title)"'`; repeat per child that has children of its own
3. Order: explicit notes in the parent body first; issues that unblock others (or fix the test suite) next; otherwise ascending issue number
4. Record the full ordered list before writing code

## 2. Branch

`git fetch origin main; git checkout -b <branch> origin/main`

## 3. Loop over every leaf issue, in order

1. Re-read its exit condition; confirm it moves toward the parent's goal
2. Load `implementation` for code and test conventions
3. Run the full build and test suite; iterate until green — never move on red
4. Commit only that issue's files (`git add <files>`, never `-A`): `<type>: <description> (#<N>)`, with the type matching the issue title prefix
5. Close it: `gh issue close <N> --comment "Implemented on <branch> at $(git rev-parse --short HEAD)."` — the native sub-issue link updates the parent's progress; there is no checklist to tick

An issue that has children is not committed itself — recurse into its row, then close it once its children are closed and its exit condition is verified.

## 4. Wrap up

Verify the parent's Definition of Done (for a bug: Actual Behavior now equals Expected Behavior, and a regression test exists). Close intermediate parents (Features, then Epics) with a comment once their children are closed. The top-level parent is closed by the PR's `Closes #<nr>` — do not close it manually, except Epics, which are closed in step 3 before the PR.

## 5. PR and merge

1. Full build/lint/test once more from a clean state; `git push -u origin HEAD`
2. Create the PR with the `github-pull-request` skill (title from the table; body `Closes #<nr>` for every parent completed, one summary line per child)
3. `gh pr checks <pr> --watch`; merge only when green, using the repo's usual strategy (`gh pr list --state merged --limit 5` if unsure). Failing checks: fix on the branch, push, re-verify

## Constraints

- One commit per leaf issue — history must be bisectable with green tests per commit
- Never close an issue whose exit condition did not actually pass
- Never merge on failing checks
- If criteria conflict between issues (e.g. a rename), implement in issue order and let the later commit do the rename
