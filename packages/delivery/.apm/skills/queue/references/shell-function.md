# Launcher and shell function

Preferred: install the launcher with `pwsh scripts/Install-QueueLauncher.ps1` (path relative to the skill directory; `-Dir <dir>`,
default `~/.local/bin`, a leading `~` is expanded; `queue.cmd` on Windows). It is a tiny script that finds the runner at call
time, `cd`s to the git toplevel and runs it with `pwsh -NoProfile -File`, so `queue` works from any subdirectory and
survives skill updates. Lookup order: `QUEUE_RUNNER` (full path to `Invoke-OrchestratorQueue.ps1`, checked first, an error
when it is not a file), then project `.claude|.opencode|.agents|.github/skills`, then `~/.claude`, `~/.agents`,
`~/.config/opencode`.

Trust: the project-local runner takes precedence over the global one and is executed with your rights, so a cloned
repository can ship its own `queue` runner. Do not run `queue` in an untrusted repository. The launcher prints
`queue: using project-local runner <path>` to stderr whenever it picks a project-local one.

A relative `-IssueFile` is resolved against the directory you typed it in (the launcher passes it as `QUEUE_CALLER_CWD`).
The launcher never edits PATH or profiles (it prints a hint when `-Dir` is not on PATH), needs `-Force` to overwrite a
different file, and `-Uninstall` removes only its own launcher. `-WhatIf` shows what would be written. The Windows
`queue.cmd` uses `setlocal`, so the `cd /d` does not leak into your shell, and returns the runner's exit code; it is covered
by text-level tests only (no Windows runner).

Alternative, a shell function. Wrap the runner once, then call `queue` from the repository root (the script must run there).

```bash
# bash / zsh (~/.bashrc, ~/.zshrc)
queue() { pwsh "$HOME/.claude/skills/queue/scripts/Invoke-OrchestratorQueue.ps1" "$@"; }
```

```powershell
# PowerShell ($PROFILE)
function queue { pwsh "$HOME/.claude/skills/queue/scripts/Invoke-OrchestratorQueue.ps1" @args }
```

Usage: `queue -DryRun -Mode full 324`, then `queue -Mode full 324`.

Paths: `~/.claude/skills/queue/...` is the global Claude Code install; a project install uses
`./.claude/skills/queue/...` (`.opencode/skills`, `.github/skills` for the other clients). Global OpenCode is
`~/.config/opencode/skills`; for Copilot CLI and other clients use the skills directory of your client.
