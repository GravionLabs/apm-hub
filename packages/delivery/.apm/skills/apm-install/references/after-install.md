# After install

## Agents: `apmw sanitize`

The `agents` package (also via `core` or `all`) ships agent files in the source format; `apm` copies them verbatim and
Claude Code then starts them without tools, OpenCode rejects them. `Install-HubPackages.ps1` runs `apmw sanitize -p <client>`
itself for every client with an agents directory (`-g` under `-Global`) and lists them as `sanitized`. Check the `notes`:

- `apmw not found`: install it (`uv tool install apmw` or `pipx install apmw`), then run the command from `notes`:

  ```powershell
  apmw sanitize -p claude      # or opencode, copilot; add -g for a global install
  ```

- `apmw sanitize -p <client> failed`: run that command by hand and read its output.
- `no client agents directory found`: run it once the client has created its directory.

Later updates: `apmw update -p <client>` (`-g` global), never `apm update` alone.

## OpenCode plugin (hooks, core or all)

Copy `packages/hooks/.apm/opencode/plugins/apm-hub-hooks.ts` (in `apm_modules`) to `.opencode/plugins/` (project) or
`~/.config/opencode/plugins/` (global) by hand, until an apmw release with GravionLabs/apmw#38 does it.

## What to commit

| Path | Action |
|:--|:--|
| `apm.yml`, `apm.lock.yaml` | commit |
| `.github/skills/`, `.claude/skills/`, `.opencode/skills/` | commit (instant context on clone) |
| `apm_modules/` | add to `.gitignore` |
