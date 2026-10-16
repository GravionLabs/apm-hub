# After install

## Agents: `apmw sanitize`

The `agents` package (also via `core` or `all`) ships agent files whose `metadata` block must be resolved per client:

```powershell
apmw sanitize -p claude      # or opencode, copilot; add -g for a global install
```

Required for OpenCode, recommended for Claude Code (per-agent model and tools) and Copilot. Install `apmw` with
`pipx install apmw` or `uv tool install apmw`, or use `apmw install -p <client>` instead of `apm install`.

## OpenCode plugin (hooks package)

Copy `packages/hooks/.apm/opencode/plugins/apm-hub-hooks.ts` (in `apm_modules`) to `.opencode/plugins/` (project) or
`~/.config/opencode/plugins/` (global) by hand, until an apmw release with GravionLabs/apmw#38 does it.

## What to commit

| Path | Action |
|:--|:--|
| `apm.yml`, `apm.lock.yaml` | commit |
| `.github/skills/`, `.claude/skills/`, `.opencode/skills/` | commit (instant context on clone) |
| `apm_modules/` | add to `.gitignore` |
