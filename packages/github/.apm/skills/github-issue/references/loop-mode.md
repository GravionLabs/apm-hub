# Loop mode (`orchestrator loop <feature|epic>`)

Runs the open PBIs of a Feature or Epic one after another in one session: select per `next-selection.md`, run the PBI as **full**, record it, reselect. The loop target (`<nr>`) is the Feature or Epic; `loop` takes no description (same answer as `next`: it needs a Feature or Epic number). Everything a `full` run does per PBI (branch, tasks, review, PR, per-PBI ledger) is unchanged.

## Loop ledger

- Path `.agents/loop-<nr>/progress.md`, written only with `pwsh <skills dir>/github-issue/scripts/Add-LedgerLine.ps1 -Issue loop-<nr> -Line '<text>'` (creates the directory; never a shell redirect).
- First line `# orchestrator ledger — loop #<nr> — branch <branch>`.
- After the PR phase of each PBI: `Loop: PBI #<nr> done — <pr>` (the PR URL from `pr-writer`).
- At the end: `Loop: stopped — <reason>` (`nothing selectable`, `headless gate: <question>`, `context warning`, `user stop`).
- Per-PBI ledgers `.agents/<pbi>/progress.md`, their `Phase`, `Task`, `Fix round` and `Ruling:` lines are unchanged: a ruling is recorded in the ledger of the PBI it was made for, never in the loop ledger. The `hooks` `SubagentStop` ledger skips `loop-*` directories, so subagent lines land in the per-PBI ledger.

## Selection and reselection

Same algorithm as `next-selection.md` on the loop target: candidates in sub-issue order, drop merged, blocked (`needs-decision`, open blocker) and in flight. Announce each pick with `Next PBI: #<nr> <title>`, then run it as **full** (the PBI becomes `<issue>`). After its PR the finished PBI is excluded by the same rule, because its PR is open: it shows as `waiting for merge: PR #<n>`. Never merge a PR to make the next PBI selectable; a PBI whose blocker is a PBI of this loop stays blocked until that PR is merged.

A `plan` is never run inside the loop beyond the plan gate of a PBI without Task sub-issues (step 3 of `full`).

## Stop conditions

1. **Nothing selectable** (first pick or any reselection): the `No candidate` report of `next-selection.md` per remaining open PBI (open blockers, `needs-decision`, `waiting for merge: PR #<n>`, `merged, closes at release`), then stop.
2. **Headless gate** (no question tool): append `Gate: <question>` to the per-PBI ledger as `full` does, report it and stop; the loop ends with it. A `Loop: stopped — headless gate` line closes the loop ledger.
3. **Context warning**: the warning text injected by the `hooks` package (`context-warning.sh`, `UserPromptSubmit` on Claude Code, `postToolUse` on Copilot, the OpenCode plugin) appeared in this session. There is no file to read: the signal is that the text has appeared in your own context. Finish the current PBI's phase (never stop between a task commit and its ledger line), write `Loop: PBI #<nr> done — <pr>` when that phase was the PR, otherwise leave the PBI resumable, append `Loop: stopped — context warning` and end with `Next: /clear, then orchestrator loop <nr>`.

The user may also stop the loop at any interactive gate.

## Interactive gates

Plan gate, review summary and `CHANGES_REQUESTED`, red suite twice: ask exactly as `full` does, then continue the loop after the answer. A gate pauses the loop, it never ends it. The "Clear before implement" question of `orchestrator-gates.md` is not asked in `loop`; the context-warning stop replaces it.

## Resume and compaction

- A loop ledger `.agents/loop-<nr>/progress.md` exists: say so in one line (`Resuming loop #<nr>: <k> PBIs done`) and continue with the selection; the PBIs with a `Loop: PBI #<pbi> done` line have an open PR and drop out by themselves. A PBI with a per-PBI ledger but no loop line resumes per the same-issue ledger rule of the agent.
- After compaction trust the loop ledger, the per-PBI ledgers and `git log` over memory.

## End report

Same as `next`: one line per PBI handled (`#<pbi> — <pr>`), the rulings verbatim, the stop reason, then the `Next:` line of `next-selection.md` ("End line after a PBI run") for the last PBI handled when its parent is a Feature (a candidate, what blocks the rest, or `Feature #<feature> is done`), and the last line `Ledger complete. Start the next issue in a new session (/clear or a new orchestrator run).`
