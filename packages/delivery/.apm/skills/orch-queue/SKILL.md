---
name: orch-queue
description: 'Run the orchestrator headless over a list of issues or a whole Feature/Epic, one fresh process per issue. Use for "run these issues overnight", "work the Feature queue", "headless batch".'
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

# orch-queue

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
pwsh scripts/Invoke-OrchestratorQueue.ps1 -Epic 300 -Harness opencode -ContinueOnError
```

Always start with `-DryRun`. Parameters: `-Harness claude|copilot|opencode` (default `claude`), `-Mode plan|implement|full`,
`-ContinueOnError`, `-AllowAll` (see [harness flags](references/harness-flags.md)), `-MergeApproved`.

## Exit codes

| Code | Meaning |
|:--|:--|
| 0 | every issue done or skipped (queue mode: `Feature #<nr> is done`) |
| 1 | a run failed (stops, unless `-ContinueOnError`), or a harness binary or adapter is missing |
| 2 | a gate: the orchestrator needs a decision; the question is printed and the queue stops |

## The ledger is the truth, not the exit code

Per issue the runner reads `.agents/<issue>/progress.md`:

- last line `Ledger complete.` is done (found before the run: skipped, nothing is started)
- a new `Gate: <question>` line is a gate: exit 2, the runner never answers it. Answer it in an interactive
  session (`claude --agent orchestrator "implement <nr>"`), then rerun the queue; finished issues are skipped
- neither is a failure: exit 1, the first error is in `.agents/<issue>/run.log`

The orchestrator appends `Ledger complete.` only after a successful run, never after a gate or failure.

## Feature and Epic queues

`-Feature <nr>` / `-Epic <nr>` loops `next <nr>` in a fresh process per iteration; selection stays in the
orchestrator (`github-issue/references/next-selection.md`). It stops on `Feature #<nr> is done`, a gate (exit 2), a
failure (exit 1) or when the same PBI is selected twice in a row. State is cached in `.agents/queue-<nr>.json`
(GitHub stays the source of truth), output in `.agents/queue-<nr>.log`. It does not use the orchestrator `loop` mode.

`-MergeApproved` (default off) squash-merges the PR of a done PBI into the integration branch when the review
verdict is APPROVE and the PR is open. Never a release PR (head `release/*` or base `main`), never after a gate or failure.

## Rules

- Permissions: the default is a narrow per-harness set, `-AllowAll` opts in to the unrestricted mode. Read
  [harness flags](references/harness-flags.md) before an unattended run: Copilot CLI cannot start subagents
  headless, and the narrow Copilot set may need `-AllowAll`.
- Check `status <nr>` (sibling PBI) or `.agents/<nr>/progress.md` before and after a run.
- Sequential only; `-Parallel` (worktrees) is a follow-up.
