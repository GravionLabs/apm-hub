# Status table

Used by the `orchestrator` mode `status <feature|epic>`: one line per PBI with its state, plus the line `next` would pick. Read-only: nothing is started.

## Sources

`gh` (sub-issues, blocked-by, PRs), `git log` on the fetched integration branch, remote branch refs and existing ledgers only. No new state file. A status run never creates `.agents/<nr>/progress.md` (that would mark the issue in progress) and writes no `Ledger complete.` line.

## Rows

Candidates exactly as `next-selection.md` `## Candidates`, but every open PBI is listed and none is dropped. Epic: grouped per Feature in sub-issue order, each group headed by `Feature #<n> <state> <title>`; a merged Feature is shown per `next-selection.md`.

## States

One state per PBI, first match wins (merged first, like `next-selection.md`):

1. `merged`: `next-selection.md` `## Merged (closes at release)`, including the partial-delivery exception; the rule is not restated here.
2. `pr-open #<n>`: the open-PR check of `next-selection.md` `## Drop the in flight`.
3. `needs-decision`: the label.
4. `blocked by #<a>, #<b>`: the open blockers from the blocked-by endpoint of `next-selection.md` `## Drop the blocked`.
5. `in progress (<detail>)`: a local `.agents/<nr>/progress.md` exists and has no line `Ledger complete.` -> detail is the last `Phase <name>: complete` phase, or `started`. Otherwise a remote branch matching `/<nr>-` in the fetched refs (`git fetch`, then `git branch -r --list '*/<nr>-*'`) -> `in progress (branch <name>)`. A ledger that ends with `Ledger complete.` does not count.
6. `open`: none of the above.

## Pick line

Last line of the table: the `next-selection.md` `## Pick` result, `Next PBI: #<nr> <title>`, or `Nothing selectable: <feature|epic> #<nr>`.

## Output

Line format `#<nr> <state> <title>`.

- Headless: write the table to `.agents/status-<nr>.md` through `Write-StatusTable.ps1` (overwrite, not append), print the final line `Status: .agents/status-<nr>.md` and stop.
- Interactive: show the table and ask which mode to start: `next <nr>`, `loop <nr>`, `plan <pbi>` for an unplanned PBI, or stop.
