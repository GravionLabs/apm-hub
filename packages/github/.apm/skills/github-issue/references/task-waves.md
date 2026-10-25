# Task waves (step 4 of `pbi-pipeline.md`)

How the Tasks of one PBI run in parallel and come back onto the PBI's one branch. The PBI, its review range, the PR and the fix rounds do not change.

## Defaults (the one place to tune them)

| Setting | Value |
|:--|:--|
| `--parallel <n>` | 1-4, **default 3**; `--parallel 1` = the sequential behaviour (one Task at a time, no task branch, no worktree) |
| Budget | at most **4 `implementer` subagents at once per repository**, across all PBIs of a run; a runner of `loop` gets `floor(4 / runners)` (`loop-mode.md`) |
| Wave width | `min(<n>, budget left)`; never above the number of unblocked Tasks |

Why 3 and 4: `docs/working-mode.md` names 4+ parallel sessions as a usage-limit driver; a PBI has 3-5 Tasks and the file rule rarely leaves more than 3 in one wave; each extra worktree costs a dependency install and a build, each extra branch raises the cherry-pick conflict risk. Revisit with `retro` data (wave width reached, conflicts, wall time).

A client without parallel subagents (see `docs/orchestrator.md` "Clients") falls back to `--parallel 1` and says so in one line: `Parallel: 1 — client has no parallel subagents`.

## Wave computation

Run `pwsh <skills dir>/github-issue/scripts/Get-TaskWaves.ps1 -Plan <state>/<pbi>/plan.json -Done <finished Tasks> -Parallel <n>` when it is available; it prints `[[task,...],...]` (the waves in order, Task = issue number or plan id). Without it, or without `plan.json`, apply the same rule by hand to the Task issues.

- Open Tasks only; the native blocked-by links decide what is unblocked (`plan.json` `blocked_by` is the cache; the script does not evaluate blockers outside the plan, check those links before dispatch). Done = ledger `Task #<nr>: DONE`, "Task merged" (`task-issues.md`) or an integrated task branch.
- A wave takes unblocked Tasks in plan order, at most `<n>`, whose `files` do not overlap (equal path or directory prefix). A Task that overlaps stays for a later wave.
- A Task of `size: L` or without `files` runs alone.
- Compute the next wave after each integration; Tasks unblocked by the previous wave can join it.
- `BASE` (`git rev-parse HEAD`) is recorded once, before the first wave, as before; `<first BASE>..HEAD` stays the review range.

## Running a wave

1. `WAVE_BASE=$(git rev-parse HEAD)` on the PBI branch (clean tree, all earlier commits made).
2. The first Task of the wave works in the PBI checkout (`<path>` of step 1b). Every other Task gets a worktree from the current PBI `HEAD` on the local branch `<type>/<pbi>-t<task>` (the PBI number stays readable for the hook's branch rule): `pwsh <skills dir>/github-issue/scripts/Enter-Checkout.ps1 -Issue <pbi>-t<task> -Branch <type>/<pbi>-t<task> -Base <integration branch> -From <WAVE_BASE>` creates `.worktrees/<pbi>-t<task>` (never the main checkout) and takes a lease; `New-Worktree.ps1 -From` is the same without the lease.
3. Install dependencies in each task worktree before its implementer starts, the way `verify-project` expects (the stack's lockfile install, e.g. `pnpm install --frozen-lockfile`); log `Worktree #<task>: install <seconds>s` in the ledger so `retro` sees the cost.
4. Dispatch **all implementers of the wave in ONE message** (Claude Code: several `Agent` calls; Copilot CLI and OpenCode: several `task` calls; VS Code: `runSubagent`). Each prompt says "work in `<path>`" (its worktree), carries the path of `<state>/<pbi>/task-<nr>.md` (written as in `pbi-pipeline.md` step 4 when missing; `<state>` is shared by all worktrees, so every implementer reads the same path), `context.md` and its report path `<state>/<pbi>/task-<nr>-report.md`, and commits with `Refs #<task>` as in `task-issues.md`. Keep only the ≤ 15-line replies; `Status` handling is unchanged (one targeted re-dispatch per Task, a red suite twice = existing gate).
5. Task branches are local only and never pushed.

## Integration (orchestrator, `git` only)

After every implementer of the wave replied `DONE`, on the PBI branch in `<path>`, in plan order:

1. For each Task: `git cherry-pick <WAVE_BASE>..<type>/<pbi>-t<task>` (the commits of that branch, oldest first; the first Task, which worked on the PBI branch itself, is already there). Success → next Task.
2. Conflict: list `git diff --name-only --diff-filter=U`, then `git cherry-pick --abort` (the PBI branch is back at its state before this Task), append `Ruling: cherry-pick conflict #<task> — re-run sequentially — one extra implementer run`, and re-dispatch that Task **sequentially on the PBI branch** after the others are integrated: the prompt names the conflicting files and the already integrated Tasks, and the Task is not `DONE` until its new commits are on the PBI branch. Its task branch is deleted after the re-run.
3. One `verify-project` on the integrated `HEAD` (Final-Verify form, `verify.json` rules of step 5: invoked directly on Claude Code, never through a general-purpose `Agent`, one full suite run). Red → the existing gate: fix round with the failure list, red twice → ask the user.
4. `pwsh <skills dir>/github-issue/scripts/Exit-Checkout.ps1 -Issue <pbi>-t<task>` per task worktree (a dirty one is kept and reported), then delete the local branch with `git update-ref -d refs/heads/<type>/<pbi>-t<task>` (cherry-picked commits have new SHAs, so `git branch -d` refuses; the git guardrail hook denies `git branch -D`). Only after Exit-Checkout: a kept dirty worktree keeps its branch.
5. Ledger, only now: `Task #<nr>: DONE — <sha> — model <name>` per Task (`<sha>` = the last commit with its `Refs` footer **on the PBI branch**), then `Wave <w>: <task list> — integrated <sha>` (`<sha>` = integrated `HEAD`), or `Wave <w>: <task list> — conflict #<task>` when a Task fell back to the sequential run. `<task list>` = `#12, #13`.

## Resume

A Task branch `<type>/<pbi>-t<task>` that exists locally with a commit `Refs #<task>` ahead of the PBI branch, and no `Task #<task>: DONE` line, is done but not integrated: integrate it (Integration above, the same order) instead of re-implementing. A worktree without such a commit is re-dispatched. The PR task list (`#<task> — <sha>`, SHA on the PBI branch), the review range and the fix rounds are unchanged.
