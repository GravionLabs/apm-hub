# Running orchestrator sessions in herdr

[herdr](https://herdr.dev) (Apache 2.0) is a terminal workspace manager for coding agents. Like tmux, a background server owns the terminals and they keep running when you detach. Unlike tmux it is mouse-first and shows every agent's state in a sidebar: `working`, `blocked` (waiting for input), `done`, `idle`. That covers the window side of a long run: one terminal, unattended by default, and you see at once when a gate needs you.

herdr does not manage context. It does not restart a session when the context grows and does not show subagents. Per-PBI context stays the job of the orchestrator: `loop` mode, and on Claude Code the planned `pbi-runner` subagent (#309), which keeps only a few k tokens per PBI in the primary. Commands below are taken from the [herdr agent guide](https://herdr.dev/agent-guide.md), checked against herdr v0.9.5; see the [herdr docs](https://herdr.dev/docs/) for anything else.

## Install

```bash
curl -fsSL https://herdr.dev/install.sh | sh     # Linux, macOS
herdr --version
```

Windows (beta): `powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"`. Homebrew, mise and Nix: [install page](https://herdr.dev/docs/install/). Update a direct install with `herdr update`.

For Claude Code, install the integration once: it adds native session restore (the agent state still comes from screen detection).

```bash
herdr integration install claude
herdr integration status
```

## Layout: one workspace per repository

`cd` into the repository and run `herdr`. It starts or attaches to the default session and creates a workspace for the directory. Split with the right-click menu or `ctrl+b` then `v` (right) / `-` (down); a new tab is `ctrl+b` then `c`; `ctrl+b` then `?` lists all bindings.

| Pane | Command | Purpose |
|:--|:--|:--|
| orchestrator | `claude --agent orchestrator "loop <feature>"` | the run; shows `blocked` at every gate |
| ledger | `tail -f <state>/loop-<feature>/progress.md` | one line per finished PBI and the stop reason |
| PBI ledger | `tail -F <state>/<pbi>/progress.md` | phases, tasks, fix rounds, subagent stops (with the `hooks` package) |
| shell | your shell | `git log`, `gh pr list`, `gh issue view` checks |

Use `next <feature>` instead of `loop` for one PBI per session, `implement <nr>` or `full <nr>` for a single issue. Flags belong to the first message, not to the `claude` command line: start `claude --agent orchestrator` and send `--fix-advisories medium loop 302` to answer the review summary up front.

## Gates

The orchestrator stops at the plan gate, the review summary (unless `--fix-advisories` is set), a review still blocked after the fix rounds and a red suite twice. In herdr the pane turns `blocked`: click it, answer the question, and the run continues. Nothing else needs you; leave the pane alone while it is `working`.

## Detach, reattach, stop

- Detach: `ctrl+b` then `q`, or close the terminal. The run keeps going.
- Reattach: `herdr` (also over SSH on the same machine, or `herdr --remote <host>` as a thin local client).
- Stop everything: `herdr server stop`. Stop just the run with `ctrl+c` in its pane; the ledger keeps the state and `loop` resumes from it.

## Queue runs

The queue (`/queue`, `Invoke-OrchestratorQueue.ps1`) starts headless processes that never ask: a gate ends the run with exit 2. herdr adds little there besides a persistent pane for a long run; start it in its own tab and keep the ledger pane next to it. For runs you want to answer, prefer `loop` in an orchestrator pane.

## Long sessions

Each `loop` run stops at its PBI cap or the `hooks` context warning. Then `/clear` in the same pane (or a new pane) and start `loop <feature>` again: finished PBIs drop out by their open or merged PR. See [Working mode](../working-mode.md) and [Looping with `loop`](../orchestrator.md#looping-with-loop).
