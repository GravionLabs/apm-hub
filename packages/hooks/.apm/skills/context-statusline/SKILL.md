---
name: context-statusline
description: '/context-statusline: install a status line (model, context %, git branch, limits) for Claude Code or Copilot CLI, plus a Claude Code subagent line. Use for "show context usage in the status line".'
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

# context-statusline

Claude Code (status line and subagent line) and GitHub Copilot CLI (status line only, experimental). Two Node scripts (Node >= 22, no dependencies, same on Linux, macOS and Windows) and an installer
that points `~/.claude/settings.json` at them. PowerShell 7+ is needed for the installer only.

## Install

```powershell
pwsh scripts/Install-Statusline.ps1 -WhatIf     # show what would change
pwsh scripts/Install-Statusline.ps1             # install for Claude Code (default)
pwsh scripts/Install-Statusline.ps1 -Client copilot   # or: all
pwsh scripts/Install-Statusline.ps1 -Force      # replace a statusLine / subagentStatusLine you set yourself
pwsh scripts/Install-Statusline.ps1 -Uninstall  # remove only our entries (and copies of older versions)
```

The installer:

- makes no copy: `statusLine` and `subagentStatusLine` become `{"type":"command","command":"node <scripts>/<file>.mjs"}` with `<scripts>` the skill's own `scripts/` directory (written as `~/...` under `$HOME`), so `apm update` refreshes the status line
- derives `<scripts>` from where it runs: in a `~/.claude/skills/` or `~/.agents/skills/` deployment each client gets its own copy (Claude Code `~/.claude/skills/context-statusline/scripts`, Copilot CLI `~/.agents/skills/context-statusline/scripts`); anywhere else (project checkout) the directory it runs from. It refuses when that script is missing (skill deployed for the other client only)
- keeps every other settings key, writes `settings.json.bak-<timestamp>` before changing, uses 2-space indent
- is idempotent; entries of older versions (`apm-hub/statusline/` copies) are migrated and their copies removed; a foreign entry is refused without `-Force`
- `-Client copilot` writes `$COPILOT_HOME` (else `~/.copilot`) `settings.json`: only `statusLine` (padding 1) and `STATUS_LINE` added to `feature_flags.enabled`. `-Uninstall` leaves the flag in place and never touches the skill files

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
