# Loop mode (`orchestrator loop <feature|epic>`)

Runs the open PBIs of a Feature or Epic one after another in one session: select per `next-selection.md`, run the PBI as **full**, record it, reselect. `<nr>` is the loop target (the Feature or Epic); `loop` takes no description (same answer as `next`: it needs a Feature or Epic number, stop). Everything a `full` run does per PBI (branch, tasks, review, PR, per-PBI ledger) is unchanged.

## Loop ledger

- Path `<state>/loop-<nr>/progress.md`, written only with `pwsh <skills dir>/github-issue/scripts/Add-LedgerLine.ps1 -Issue loop-<nr> -Line '<text>'` (creates the directory; never a shell redirect). `Add-LedgerLine` writes no headers: write the header line `# orchestrator ledger — loop #<nr> — branch <branch>` yourself, only when `<state>/loop-<nr>/progress.md` does not exist yet.
- At each PBI boundary: `Loop: PBI #<nr> started` (written by `-Bind`, below). After the PR phase of each PBI: `Loop: PBI #<nr> done — <pr>` (the PR URL from `pr-writer`).
- At the end: `Loop: stopped — <reason>` with exactly one of `nothing selectable`, `headless gate: <question>`, `context warning`, `pbi cap`, `user stop`; runner mode adds `runner blocked` and `runner failed`.
- Per-PBI ledgers `<state>/<pbi>/progress.md`, their `Phase`, `Task`, `Fix round` and `Ruling:` lines are unchanged: a ruling is recorded in the ledger of the PBI it was made for, never in the loop ledger. The `hooks` `SubagentStop` ledger and the OpenCode plugin skip `loop-<nr>` directories and write orchestrator subagent lines to the per-PBI ledger of the bound PBI (loop marker below), else of the branch issue (rules: [orchestrator.md § Hooks](https://github.com/GravionLabs/apm-hub/blob/main/docs/orchestrator.md#hooks)).
- PBI boundary: right after announcing `Next PBI: #<nr> <title>` and before dispatching `issue-reader`, create `<state>/<pbi>/progress.md` with its header (`Add-LedgerLine.ps1 -Issue <pbi> -Line '# orchestrator ledger — issue #<pbi> — branch <branch>'`), then bind the loop to it: `Add-LedgerLine.ps1 -Issue <pbi> -Bind loop-<nr>` appends `Loop: PBI #<pbi> started` to the loop ledger and writes the marker `<state>/current` (`<pbi> loop-<nr>`, plus the issue number of the branch it ran on when that is another issue). The hook and the plugin use the marker before the branch number only while the loop ledger's last `Loop: ` line is not a `Loop: stopped` line and the current branch carries no issue number, `<pbi>`, the recorded number, or a number with a `Loop: PBI #<nr> done` line; any other issue branch wins. So the stop lines of the new PBI's `issue-reader`, `explorer` and `planner` land in its own ledger although its branch is not checked out yet. `-Bind` fails without the PBI ledger; every stop runs `Add-LedgerLine.ps1 -Unbind` right after the `Loop: stopped` line. The reader then reports `ledger: resume` on a header-only ledger, which resumes at step 1: no difference to a fresh start.

## Selection and reselection

Same algorithm as `next-selection.md` on the loop target, run by the orchestrator itself with `gh` (sub-issues of `<nr>`, recursive for an Epic): candidates in sub-issue order, drop merged, blocked (`needs-decision`, open blocker) and in flight. Announce each pick with `Next PBI: #<nr> <title>`, then run it as **full** (the PBI becomes `<issue>`). The selection never reads the `Loop: … done` lines: a finished PBI drops out because its PR is open (`waiting for merge: PR #<n>`) or merged (`merged, closes at release`); a PBI whose PR was closed without merge is selected again. Never merge a PR to make the next PBI selectable. A blocked-by chain inside one Feature ends the loop after the first PBI of the chain while its PR is open: that is the normal `nothing selectable` stop with the `waiting for merge` reason, not an error.

A `plan` is never run inside the loop beyond the plan gate of a PBI without Task sub-issues (step 3 of `full`).

## Stop conditions

Checked before every reselection, in this order:

1. **Context warning**: the warning text injected by the `hooks` package appeared in this session. There is no file to read: the signal is that the text has appeared in your own context. Clients differ: Copilot CLI (`postToolUse`) injects it after any tool call, so it fires inside a running loop; Claude Code (`UserPromptSubmit`) and OpenCode (`chat.message`) inject it only with a user message, so in an unattended loop it appears at the earliest when the user answers an interactive gate.
2. **PBI cap**: 3 PBIs finished in this loop run (10 in runner mode) (`Loop: PBI … done` lines written by this run). The fallback for clients where the warning cannot fire mid-loop; the `hooks` package improves it, it does not replace it. Ledger reason `pbi cap`.
3. **Nothing selectable** (first pick or any reselection): the `No candidate` report of `next-selection.md` per remaining open PBI (open blockers, `needs-decision`, `waiting for merge: PR #<n>`, `merged, closes at release`), then stop.

A **headless gate** (no question tool) stops the loop at once: append `Gate: <question>` to the per-PBI ledger as `full` does, report it, `Loop: stopped — headless gate: <question>`. The review summary is exempt when `--fix-advisories` is set; the policy applies to every PBI of the loop. The user may stop the loop at any interactive gate (`user stop`). On every stop finish the current step first (never stop between a task commit and its ledger line), write the loop line of a PBI whose PR phase is complete, then the `Loop: stopped` line, then `Add-LedgerLine.ps1 -Unbind`.

## Runner mode (Claude Code)

Used when the client is Claude Code and the session has the `Agent` and `SendMessage` tools (`SendMessage` is deferred: load it with `ToolSearch` first); every other client keeps the inline loop of this file, unchanged. The primary only selects, relays and records; the PBI pipeline runs in `pbi-runner`.

1. Select and announce as above, then create the PBI ledger header and bind it (boundary rule above).
2. Dispatch `pbi-runner` with `Agent` (`subagent_type: pbi-runner`, `model: sonnet`) and `{pbi, loop: <nr>, flags, context}`; `flags` forwards `--fix-advisories` and `--no-review-summary` verbatim. Keep only its JSON and the agent id.
3. `GATE` reply: ask with `AskUserQuestion` (options from the reply, recommended first), then `SendMessage` the answer to the runner's agent id; repeat until a final status. The primary makes no `Ruling:` itself; the runner records it. Question tool unavailable: the primary learns it by trying `AskUserQuestion` on the first `GATE`; a tool-unavailable error (or no such tool) means headless for the rest of the run. Headless: the runner already wrote `Gate:`; append `Loop: stopped — headless gate: <question>` and stop. The runner is not resumed (its last ledger line stays `Gate:`, with no `Ruling:`); a queue reader treats a `Gate:` without a later `Ruling:` as stopped, an answered gate has both.
4. `DONE` → `Loop: PBI #<nr> done — <pr>`, then the stop checks and reselection. `BLOCKED` → `Loop: stopped — runner blocked`; `FAILED` (also `issue-reader` `{error}` and a `pr-writer` failure after its retry) → `Loop: stopped — runner failed`; add the summary to the end report.
5. Cap: 10 finished PBIs in runner mode (3 inline). The context warning still stops the loop. Every `Loop: stopped` line of runner mode is followed by `Add-LedgerLine.ps1 -Unbind`, as inline.

## Interactive gates

Plan gate, review summary (not with `--fix-advisories`: the policy answers it) and `CHANGES_REQUESTED`, red suite twice: ask exactly as `full` does, then continue the loop after the answer. A gate pauses the loop, it never ends it. The "Clear before implement" question of `orchestrator-gates.md` is not asked in `loop`; the context-warning and cap stops replace it.

## Resume and compaction

- A loop ledger `<state>/loop-<nr>/progress.md` exists: say so in one line (`Resuming loop #<nr>: <k> PBIs done`), do not rewrite the header, and run the selection again on the loop target: the finished PBIs drop out by the open-PR or merged rule above, not by the ledger. The cap counts only PBIs finished in the current run. A PBI with a per-PBI ledger but no loop line resumes per the same-issue ledger rule of the agent.
- After compaction trust the loop ledger, the per-PBI ledgers and `git log` over memory.

## End report

Same shape as `next`: one line per PBI handled (`#<pbi> — <pr>`), the rulings verbatim, the `Loop: stopped — <reason>` line, then exactly one `Next:` line and the last line `Ledger complete. Start the next issue in a new session (/clear or a new orchestrator run).` The `Next:` line: the loop stopped with a PBI still selectable or paused (context warning, cap, headless gate, user stop) → `Next: #<nr> <title> — orchestrator loop <feature> after /clear` (`<feature>` is the loop target, an Epic too; `#<nr>` the PBI the next run starts with); nothing selectable → the variants of `next-selection.md` "End line after a PBI run" (what blocks the rest, or `Feature #<feature> is done`).
