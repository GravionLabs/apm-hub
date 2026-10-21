---
name: queue
description: '/queue: run the orchestrator headless over issues or a Feature/Epic, one fresh process each; /queue install adds a launcher. Use for "run these issues overnight", "work the Feature queue".'
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

# queue

`scripts/Invoke-OrchestratorQueue.ps1` starts one fresh headless `orchestrator` process per issue (own context, no
cache rewrite from a long session). Plan interactively first: the plan gate needs you, a headless run only
implements an already planned issue. PowerShell 7+, run from the repository root.

## Usage

```powershell
pwsh scripts/Invoke-OrchestratorQueue.ps1 -DryRun 101 102 103          # prints the exact commands, runs nothing
pwsh scripts/Invoke-OrchestratorQueue.ps1 -Mode implement 101 102 103   # issue list (default mode: full)
pwsh scripts/Invoke-OrchestratorQueue.ps1 -Mode implement -IssueFile todo.txt   # one number per line
pwsh scripts/Invoke-OrchestratorQueue.ps1 -Mode implement -Label ready          # open issues with a label, ascending
pwsh scripts/Invoke-OrchestratorQueue.ps1 -Feature 227                  # loop "next 227" until the Feature is done
pwsh scripts/Invoke-OrchestratorQueue.ps1 -Epic 300 -Harness opencode -ContinueOnError   # same for an Epic
pwsh scripts/Invoke-OrchestratorQueue.ps1 -Status 248                   # one-shot headless status, prints <state>/status-248.md
```

Start with `-DryRun`. Parameters: `-Harness claude|copilot|opencode` (default `claude`), `-Mode plan|implement|full`
(not with `-Feature`/`-Epic`: the mode is always `next`, the adapters forward it as `next <nr>`), `-ContinueOnError`,
`-AllowAll` (see [harness flags](references/harness-flags.md)), `-MergeApproved` (opt-in, otherwise the runner never merges), `-TrustedOnly` (with `-Label`),
`-Status <nr>` (alone: no other selector or option), `-FixAdvisories none|medium|all[:dim,dim]` (lowercase dimensions; forwarded as `--fix-advisories <policy>`, no review-summary gate; CRITICAL/HIGH always block).

## Slash usage

`/queue [dry-run] [fix=<policy>] [full|implement|plan] <nr>...`, `/queue [dry-run] feature <nr>`, `/queue [dry-run] epic <nr>`, `/queue [dry-run] status <nr>`,
`/queue install`, `/queue uninstall`. Examples: `/queue 101` (default mode full), `/queue full 324`, `/queue dry-run implement 101 102`, `/queue dry-run feature 248`, `/queue epic 300`. Mapping: `dry-run` is `-DryRun` (recommend it first) and may be followed by the mode word; a mode word `full|implement|plan`
is `-Mode <word>` (none: the runner default `full`); `status <nr>` is `-Status` (no mode word, no `fix=`); `feature <nr>` / `epic <nr>` is `-Feature` / `-Epic` and takes no
mode (`/queue implement feature 248` is rejected with a message, the mode is always `next`); remaining numbers are
positional issues. `fix=medium|all|none[:dim]` is `-FixAdvisories <policy>`, only when the user gives it. Pass `-AllowAll` or `-MergeApproved` through only when the user asks for it explicitly. `install` /
`uninstall` runs the installer (below), not the runner. Run `pwsh scripts/Invoke-OrchestratorQueue.ps1 ...` from the
repository root, print the summary lines and the exit code, and never answer a gate. Every child is a fresh process;
start long runs from a plain terminal, see [launcher and shell function](references/shell-function.md).

## Install a launcher

```powershell
pwsh scripts/Install-QueueLauncher.ps1            # ~/.local/bin/queue (Windows: queue.cmd)
pwsh scripts/Install-QueueLauncher.ps1 -Uninstall # removes only our launcher
```

Then `queue -DryRun 101` works from any repository subdirectory. The launcher runs the project-local runner before the global
one, with your rights: do not run `queue` in a repository you do not trust. `QUEUE_RUNNER` overrides the lookup. Ask the user
before a non-default `-Dir`. Details: [launcher and shell function](references/shell-function.md).

## Exit codes

| Code | Meaning |
|:--|:--|
| 0 | every issue done or skipped (queue mode: `Feature #<nr> is done`; `-Status`: the status file was written) |
| 1 | a run failed (stops, unless `-ContinueOnError`), a harness binary or adapter is missing, or `-Status` wrote no fresh file |
| 2 | a gate: the orchestrator needs a decision; the question is printed and the queue stops (`-Status`: also a gate) |
| 3 | queue mode only: `Nothing selectable`, every open PBI is held by blockers or decisions (state `blocked`) |

## The ledger is the truth, not the exit code

Per issue the runner reads `<state>/<issue>/progress.md` (`<state>`: `DROMOS_STATE_DIR`, else `<git common dir>/agents`):

- last line `Ledger complete.` is done (found before the run: skipped, nothing is started)
- a new `Gate: <question>` line is a gate: exit 2, the runner never answers it. Answer it in an interactive
  session (`claude --agent orchestrator "implement <nr>"`), then rerun the queue; finished issues are skipped
- neither is a failure: exit 1, the first error is in `<state>/<issue>/run.log`

The orchestrator appends `Ledger complete.` only after a successful run, never after a gate or failure.

## Feature and Epic queues

`-Feature <nr>` / `-Epic <nr>` loops `next <nr>` in a fresh process per iteration; selection stays in the
orchestrator (`github-issue/references/next-selection.md`). It stops on `Feature #<nr> is done`, a gate (exit 2), a
failure (exit 1), `Nothing selectable` (exit 3) or when the same PBI is selected twice in a row; `-ContinueOnError`
continues after a failed PBI only if `next` then picks a different one. Epics end on `Epic #<nr> is done.`. A complete
PBI ledger wins over a `Gate:` line, as in list mode. State is cached in `<state>/queue-<nr>.json`
(GitHub stays the source of truth), output in `<state>/queue-<nr>.log`. It does not use the orchestrator `loop` mode.

`-MergeApproved` (default off) merges the PR of a done PBI when the last `Verdict:` line of the run is exactly
`APPROVE` (the whole line, no suffix) and the child exited 0. The PR comes from the ledger line `Phase pull-request: complete — <url>` and `gh pr list`, its head branch must
belong to the PBI (`/<pbi>-`), its base must be `release/*` and its head must not be `release/*` (the release PR). It runs
`gh pr merge --squash --match-head-commit <sha>`. Fork PRs, PRs that are not mergeable/clean (UNKNOWN is polled 3 times,
`QUEUE_POLL_SECONDS`), failing or missing checks ("no checks reported") and a head that differs from the local branch tip (or,
without a local branch, from the tip on origin; unverifiable also skips) are skipped with a note; set branch protection with required checks.
A `Gate:` line in the output stops the queue even without a new ledger gate. Never after a gate, a block or a failure.

## Rules

- Permissions: the default is a narrow per-harness set, `-AllowAll` opts in to the unrestricted mode. Read
  [harness flags](references/harness-flags.md) before an unattended run: Copilot CLI cannot start subagents
  headless, and the narrow Copilot set may need `-AllowAll`.
- The narrow permission set limits accidents; it does not stop prompt injection (an allowed `gh api` or `pwsh` can
  do a lot, including `gh pr merge` via `gh api`). `-Label` feeds issue text to the model: use collaborator-authored
  issues; `-TrustedOnly` filters only the issue author (not comments); positional and `-IssueFile` issues are unfiltered.
- The runner refuses a symlinked state dir. Check `/queue status <nr>` or `<state>/<nr>/progress.md` before and after a run. Sequential only (`-Parallel` is a follow-up). Issue-list mode inside a repository picks each run directory with `Enter-Checkout.ps1` (main checkout when no live lease `<state>/leases/` and no modified tracked file holds it, else `.worktrees/<nr>`; branch `feat/<nr>` from `-Base`, default `release/next`) and releases it with `Exit-Checkout.ps1` after the verdict; a gate keeps lease and worktree and prints the path to resume in.
