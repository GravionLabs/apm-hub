# Launcher and shell function

Preferred: install the launcher with `pwsh <skills>/queue/scripts/Install-QueueLauncher.ps1` (`-Dir <dir>`, default
`~/.local/bin`; `queue.cmd` on Windows). It is a tiny script that finds the runner at call time (project
`.claude|.opencode|.agents|.github/skills`, then `~/.claude`, `~/.agents`, `~/.config/opencode`), `cd`s to the git
toplevel and runs it with `pwsh -NoProfile -File`, so `queue` works from any subdirectory and survives skill updates. It
never edits PATH or profiles (it prints a hint when `-Dir` is not on PATH), needs `-Force` to overwrite a different file,
and `-Uninstall` removes only its own launcher. `-WhatIf` shows what would be written.

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
