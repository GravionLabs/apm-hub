# Shell function

Wrap the runner once, then call `queue` from the repository root (the script must run there).

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
