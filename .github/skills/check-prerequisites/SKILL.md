---
name: check-prerequisites
description: 'Check that the tools apm-hub skills need (pwsh 7+, Git, Node.js, npm; optionally gh, jq, yq, ast-grep, Python 3, apmw) are installed, and install missing ones. Use when setting up an environment.'
---

Verify the environment for apm-hub skills. Paths to `scripts/` are relative to this skill's directory.

- Run `pnpm run check` to execute the local build, formatting, manifest, skill-report, and test checks.
- **Core/runtime** (always): PowerShell 7+, Git, Node.js, npm
- **Runner** (always reported, never fails): `dromos --version`; install with `npm i -g dromos`
- **Optional** (`-Full`): `gh`, `curl`, `jq`, `yq`, `ast-grep`, Python 3, `apmw` (for the `agents` package, also in `core`/`all`; `uv tool install apmw` or `pipx install apmw`). `apmw` is reported as missing even without `-Full` when an installed agent file is still in the source format (a top-level `metadata:` key): Claude Code starts such agents without tools, OpenCode rejects them; fix with `apmw sanitize -g -p <client>`.

```powershell
pwsh scripts/Check-Prerequisites.ps1 [-Full] [-AutoInstall]
```

The script prints each tool with its version or ✗ and installation instructions per platform. `-AutoInstall` uses `winget` (Windows), `brew` (macOS) or `apt-get`/`dnf` (Linux).

## Gotchas

- Must run under PowerShell 7+ (`pwsh`), not `sh`
- `-AutoInstall` may need administrator rights on Windows and needs internet access
- Custom package managers are not supported; install those tools manually
