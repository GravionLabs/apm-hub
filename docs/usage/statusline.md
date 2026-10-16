# Status line and subagent status line

The `context-statusline` skill of the `hooks` package (Claude Code; the status line also on GitHub Copilot CLI) shows how full the context is, in the status line
of the main session and per subagent in the agent panel. It keeps the [working mode](../working-mode.md) honest: you see the
context grow before the 150k warning fires.

```text
jk@laptop:/repo Opus 4 ctx:42% (feat/354-statusline) 5h:12% 7d:30%     # statusLine
explorer haiku-4-5 ctx:18% (36k) · scan the hooks package               # subagentStatusLine, one row per subagent
```

Colours of the subagent rows: green below 50 %, yellow below 80 %, red above. Without `contextWindowSize` only the token
count (`36k`) is shown.

## Install

```powershell
pwsh <skill dir>/scripts/Install-Statusline.ps1 [-Force] [-Uninstall] [-WhatIf]
```

Or run `/context-statusline`. The installer copies `statusline.mjs` and `subagent-statusline.mjs` to
`~/.claude/apm-hub/statusline/` and sets `statusLine` and `subagentStatusLine` in `~/.claude/settings.json` to
`node ~/.claude/apm-hub/statusline/<file>.mjs`. Other keys stay untouched, a `settings.json.bak-<timestamp>` is written
first, and a second run changes nothing. A `statusLine` you set yourself is replaced only with `-Force`; `-Uninstall`
removes only the entries and files this installer wrote. Re-run it after `apm update` to refresh the copies.

## GitHub Copilot CLI

Copilot CLI has an experimental `statusLine` and no subagent equivalent. `Install-Statusline.ps1 -Client copilot` (or `all`):

- copies `statusline.mjs` to `~/.copilot/apm-hub/statusline/` (own copy, independent of the Claude Code one; with `COPILOT_HOME` set, to `$COPILOT_HOME/apm-hub/statusline/` and the command carries that absolute path with `/`)
- sets `statusLine` to `{"type":"command","command":"node ~/.copilot/apm-hub/statusline/statusline.mjs","padding":1}` in `~/.copilot/settings.json` (or `$COPILOT_HOME/settings.json`)
- adds `STATUS_LINE` once to `feature_flags.enabled`, keeping other flags and keys
- same backup, idempotency, `-Force` and `-WhatIf` rules as for Claude Code; `-Uninstall` removes the entry and script but leaves the `STATUS_LINE` flag (another status line may rely on it)

The script prefers `context_window.current_context_used_percentage` (matches `/context`) over `used_percentage`. Copilot sends no
`rate_limits`, so `5h`/`7d` is omitted. The Copilot payload fields (`cwd`, `session_id`, `model.id`, `model.display_name`,
`workspace.current_dir`, `context_window.*`, `cost.total_premium_requests`) are taken from community guides, not from official
documentation, and may change while the feature is experimental.

## Requirements and behaviour

- Node 22 or newer at run time; no packages. The same command works on Linux, macOS and Windows (`~` and `/` are expanded
  by Claude Code, through Git Bash if present, else PowerShell). The installer needs PowerShell 7+.
- The scripts run on every refresh: no network, `git --no-optional-locks` with a 1 s timeout, always exit 0. Missing or
  null fields are skipped; garbage on stdin gives defaults (status line) or no output (subagent line).
