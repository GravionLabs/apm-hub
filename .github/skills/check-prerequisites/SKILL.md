---
name: check-prerequisites
description: >
  Checks that the tools apm-hub skills depend on are installed (PowerShell 7+,
  Git, Node.js, npm; optionally gh, curl, jq, yq, ast-grep, Python 3) and can
  install missing ones. Use when setting up a new environment, before running
  skills, or when a skill fails because a tool is missing.
---

Verify the environment for apm-hub skills. Paths to `scripts/` are relative to this skill's directory.

- **Core/runtime** (always): PowerShell 7+, Git, Node.js, npm
- **Optional** (`-Full`): `gh`, `curl`, `jq`, `yq`, `ast-grep`, Python 3

```powershell
pwsh scripts/Check-Prerequisites.ps1 [-Full] [-AutoInstall]
```

The script prints each tool with its version or ✗ and installation instructions per platform. `-AutoInstall` uses `winget` (Windows), `brew` (macOS) or `apt-get`/`dnf` (Linux).

## Gotchas

- Must run under PowerShell 7+ (`pwsh`), not `sh`
- `-AutoInstall` may need administrator rights on Windows and needs internet access
- Custom package managers are not supported; install those tools manually
