---
name: context-statusline
description: '/context-statusline: install a status line (model, context %, git branch, limits) for Claude Code or Copilot CLI, plus a Claude Code subagent line. Use for "show context usage in the status line".'
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

# context-statusline

Claude Code (status line and subagent line) and GitHub Copilot CLI (status line only, experimental). Two Node scripts (Node >= 22, no dependencies, same on Linux, macOS and Windows) and an installer
that wires them into `~/.claude/settings.json`. PowerShell 7+ is needed for the installer only.

## Install

```powershell
pwsh scripts/Install-Statusline.ps1 -WhatIf     # show what would change
pwsh scripts/Install-Statusline.ps1             # install for Claude Code (default)
pwsh scripts/Install-Statusline.ps1 -Client copilot   # or: all
pwsh scripts/Install-Statusline.ps1 -Force      # replace a statusLine / subagentStatusLine you set yourself
pwsh scripts/Install-Statusline.ps1 -Uninstall  # remove only our entries and files
```

The installer:

- copies `statusline.mjs` and `subagent-statusline.mjs` to `~/.claude/apm-hub/statusline/`
- sets `statusLine` and `subagentStatusLine` to `{"type":"command","command":"node ~/.claude/apm-hub/statusline/<file>.mjs"}`
- keeps every other settings key, writes `settings.json.bak-<timestamp>` before changing, uses 2-space indent
- is idempotent; a foreign entry (not pointing at `apm-hub/statusline/`) is refused without `-Force`
- `-Client copilot` writes `$COPILOT_HOME` (else `~/.copilot`) `settings.json`: only `statusLine` (padding 1) and `STATUS_LINE` added to `feature_flags.enabled`; it has its own script copy under `apm-hub/statusline/` there. `-Uninstall` leaves the flag in place
- re-run it after `apm update` to refresh the copied scripts

Restart Claude Code (or open a new session) to see the lines.

## What you get

| Script | Output |
|:--|:--|
| `statusline.mjs` | `user@host:dir`, model, `ctx:<pct>% (<used>k/<size>k)` (no size part without a window size), `(git branch)`, `5h:<pct>% 7d:<pct>%` (each green below 50 %, yellow below 80 %, red above). Fields that are null or missing are skipped |
| `subagent-statusline.mjs` | one row per subagent: `<agentType> <model> ctx:<pct>% (<k>k/<size>k) · <label>` (`1M` for a 1,000,000 window); green below 50 %, yellow below 80 %, red above; only `<k>k` when the context window size is unknown |

Both scripts run on every refresh tick: no network, git with `--no-optional-locks` and a 1 s timeout, always exit 0;
unparseable input gives the defaults (status line) or no output (subagent line).

## Rules

- Never edit other `settings.json` keys by hand-rolled text replacement; use the installer.
- Windows: `~` and forward slashes are expanded by Claude Code in the command, Git Bash or PowerShell.
- Copilot CLI has no subagent status line, and sends no `rate_limits` (the `5h`/`7d` part stays empty); its payload fields are from community guides, not official docs. OpenCode has no equivalent.
