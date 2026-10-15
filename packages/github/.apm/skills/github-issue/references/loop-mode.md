# Loop mode (`orchestrator loop <feature|epic>`)

Runs the open PBIs of a Feature or Epic one after another in one session: select per `next-selection.md`, run the PBI as **full**, record it, reselect. `<nr>` is the loop target (the Feature or Epic); `loop` takes no description (same answer as `next`: it needs a Feature or Epic number, stop). Everything a `full` run does per PBI (branch, tasks, review, PR, per-PBI ledger) is unchanged.

## Loop ledger

- Path `.agents/loop-<nr>/progress.md`, written only with `pwsh <skills dir>/github-issue/scripts/Add-LedgerLine.ps1 -Issue loop-<nr> -Line '<text>'` (creates the directory; never a shell redirect). `Add-LedgerLine` writes no headers: write the header line `# orchestrator ledger — loop #<nr> — branch <branch>` yourself, only when `.agents/loop-<nr>/progress.md` does not exist yet.
- After the PR phase of each PBI: `Loop: PBI #<nr> done — <pr>` (the PR URL from `pr-writer`).
- At the end: `Loop: stopped — <reason>` with exactly one of `nothing selectable`, `headless gate: <question>`, `context warning`, `pbi cap`, `user stop`.
- Per-PBI ledgers `.agents/<pbi>/progress.md`, their `Phase`, `Task`, `Fix round` and `Ruling:` lines are unchanged: a ruling is recorded in the ledger of the PBI it was made for, never in the loop ledger. The `hooks` `SubagentStop` ledger and the OpenCode plugin skip `loop-<nr>` directories, so subagent lines land in the newest per-PBI ledger.
- PBI boundary: right after announcing `Next PBI: #<nr> <title>` and before dispatching `issue-reader`, create `.agents/<pbi>/progress.md` with its header (`Add-LedgerLine.ps1 -Issue <pbi> -Line '# orchestrator ledger — issue #<pbi> — branch <branch>'`); otherwise the reader's stop line of the new PBI lands in the previous PBI's ledger (the hook picks the newest existing one). The reader then reports `ledger: resume` on a header-only ledger, which resumes at step 1: no difference to a fresh start.

## Selection and reselection

Same algorithm as `next-selection.md` on the loop target, run by the orchestrator itself with `gh` (sub-issues of `<nr>`, recursive for an Epic): candidates in sub-issue order, drop merged, blocked (`needs-decision`, open blocker) and in flight. Announce each pick with `Next PBI: #<nr> <title>`, then run it as **full** (the PBI becomes `<issue>`). The selection never reads the `Loop: … done` lines: a finished PBI drops out because its PR is open (`waiting for merge: PR #<n>`) or merged (`merged, closes at release`); a PBI whose PR was closed without merge is selected again. Never merge a PR to make the next PBI selectable. A blocked-by chain inside one Feature ends the loop after the first PBI of the chain while its PR is open: that is the normal `nothing selectable` stop with the `waiting for merge` reason, not an error.

A `plan` is never run inside the loop beyond the plan gate of a PBI without Task sub-issues (step 3 of `full`).

## Stop conditions

Checked before every reselection, in this order:

1. **Context warning**: the warning text injected by the `hooks` package appeared in this session. There is no file to read: the signal is that the text has appeared in your own context. Clients differ: Copilot CLI (`postToolUse`) injects it after any tool call, so it fires inside a running loop; Claude Code (`UserPromptSubmit`) and OpenCode (`chat.message`) inject it only with a user message, so in an unattended loop it appears at the earliest when the user answers an interactive gate.
2. **PBI cap**: 3 PBIs finished in this loop run (`Loop: PBI … done` lines written by this run). The fallback for clients where the warning cannot fire mid-loop; the `hooks` package improves it, it does not replace it. Ledger reason `pbi cap`.
3. **Nothing selectable** (first pick or any reselection): the `No candidate` report of `next-selection.md` per remaining open PBI (open blockers, `needs-decision`, `waiting for merge: PR #<n>`, `merged, closes at release`), then stop.

A **headless gate** (no question tool) stops the loop at once: append `Gate: <question>` to the per-PBI ledger as `full` does, report it, `Loop: stopped — headless gate: <question>`. The review summary is exempt when `--fix-advisories` is set; the policy applies to every PBI of the loop. The user may stop the loop at any interactive gate (`user stop`). On every stop finish the current step first (never stop between a task commit and its ledger line), write the loop line of a PBI whose PR phase is complete, then the `Loop: stopped` line.

## Interactive gates

Plan gate, review summary (not with `--fix-advisories`: the policy answers it) and `CHANGES_REQUESTED`, red suite twice: ask exactly as `full` does, then continue the loop after the answer. A gate pauses the loop, it never ends it. The "Clear before implement" question of `orchestrator-gates.md` is not asked in `loop`; the context-warning and cap stops replace it.

## Resume and compaction

- A loop ledger `.agents/loop-<nr>/progress.md` exists: say so in one line (`Resuming loop #<nr>: <k> PBIs done`), do not rewrite the header, and run the selection again on the loop target: the finished PBIs drop out by the open-PR or merged rule above, not by the ledger. The cap counts only PBIs finished in the current run. A PBI with a per-PBI ledger but no loop line resumes per the same-issue ledger rule of the agent.
- After compaction trust the loop ledger, the per-PBI ledgers and `git log` over memory.

## End report

Same shape as `next`: one line per PBI handled (`#<pbi> — <pr>`), the rulings verbatim, the `Loop: stopped — <reason>` line, then exactly one `Next:` line and the last line `Ledger complete. Start the next issue in a new session (/clear or a new orchestrator run).` The `Next:` line: the loop stopped with a PBI still selectable or paused (context warning, cap, headless gate, user stop) → `Next: #<nr> <title> — orchestrator loop <feature> after /clear` (`<feature>` is the loop target, an Epic too; `#<nr>` the PBI the next run starts with); nothing selectable → the variants of `next-selection.md` "End line after a PBI run" (what blocks the rest, or `Feature #<feature> is done`).
