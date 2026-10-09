---
name: check-prerequisites
description: >
  Checks and validates that all global prerequisites are installed for apm-hub skills.
  Use this skill when setting up a new environment, before running skills, or to verify
  system readiness, even if the user does not explicitly mention prerequisites or
  check-prerequisites. Optionally auto-installs missing tools. Run with -Full flag to
  check optional tools like jq, yq, ast-grep.
metadata:
  requires: PowerShell 7+ on Windows, macOS, or Linux
---

## Overview

Verify that your system has all required prerequisites for running apm-hub skills.

This skill checks:
- **CORE** (always): PowerShell 7+, Git
- **RUNTIME** (always): Node.js, npm (for TypeScript/Node skills)
- **OPTIONAL** (with `-Full` flag): `gh`, `curl`, `jq`, `yq`, `ast-grep`, Python 3

If any tools are missing, the script provides installation instructions.

## Prerequisites

- PowerShell 7+
- Internet access (for installing missing tools)

## Instructions

### Quick Check (CORE + RUNTIME)

Check if all core and runtime prerequisites are installed:

```powershell
pwsh scripts/Check-Prerequisites.ps1
```

This shows:
- PowerShell version
- Git version
- Node.js version
- npm version
- Summary of which tools are available ✓ or missing ✗

### Full Check (Including OPTIONAL Tools)

Check all prerequisites including optional tools:

```powershell
pwsh scripts/Check-Prerequisites.ps1 -Full
```

Includes: `gh`, `curl`, `jq`, `yq`, `ast-grep`, Python 3

### Auto-Install Missing Tools

Automatically install missing prerequisites (where possible):

```powershell
pwsh scripts/Check-Prerequisites.ps1 -AutoInstall
```

Uses:
- **Windows**: `winget` (if available), otherwise prompts for manual installation
- **macOS**: `brew`
- **Linux**: `apt-get` (Ubuntu/Debian) or `dnf` (Fedora/RHEL)

### Combine Flags

Check all prerequisites and auto-install missing ones:

```powershell
pwsh scripts/Check-Prerequisites.ps1 -Full -AutoInstall
```

## Output

Read `assets/output-examples.md` for success and failure output examples.

## Gotchas

- **PowerShell requirement**: This script must be run with PowerShell 7+, not bash or sh. Use `pwsh` command, not `sh`.
- **Administrator access**: Auto-install on Windows may require administrator privileges.
- **Package managers**: Script auto-installs assume standard package managers (winget, brew, apt). If you use custom tools, install manually.
- **Internet required**: Auto-install requires internet access to download packages.
- **Platform detection**: Script auto-detects your OS. Manual installation instructions are provided for each platform.

## See Also

- [Prerequisites Documentation](../../docs/prerequisites.md) — Detailed installation guide for each tool
- [Skills Overview](../../docs/concepts/skills.md) — Learn about skill requirements
