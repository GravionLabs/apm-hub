---
name: apm-install
description: '/apm-install: detect the stack and install the matching apm-hub packages into this project or globally (-g). Use for "install apm-hub", "set up the skills here".'
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

# apm-install

`scripts/Install-HubPackages.ps1` resolves the apm-hub packages a project needs and installs them with `apm install
GravionLabs/apm-hub/packages/<pkg>`. PowerShell 7+ and `apm` are required (the script exits 1 with an install hint
otherwise). Run from the project root.

## Slash usage

`/apm-install` (detect and propose), `/apm-install ts py` (named packages, no detection), `/apm-install core -g`
(user-wide), `/apm-install dry-run ...` (print the commands only). Mapping: `dry-run` is `-DryRun`, `-g` is `-Global`,
remaining words are `-Packages` (comma-separated on the command line: `-Packages ts,py`). Valid packages: `shared`,
`github`, `delivery`, `statusline`, `core`, `all`, `ts`, `py`, `ng`, `dotnet`, `rust`, `go`; anything else makes the script exit 1.
The contributor tooling package is not offered. What each package brings: [packages](references/packages.md).

## Steps

1. Always run a dry run first and show the user the proposal (`wouldInstall`, `skipped`, `commands`, `notes`):

   ```powershell
   pwsh scripts/Install-HubPackages.ps1 -DryRun                    # detect, propose
   pwsh scripts/Install-HubPackages.ps1 -DryRun -Packages ts,py    # explicit packages
   pwsh scripts/Install-HubPackages.ps1 -DryRun -Packages core -Global
   ```

2. Ask for confirmation. Never install without it, even when the packages were named in the slash command.
3. Run the same command without `-DryRun`. The result lists `installed`, `skipped`, `failed`, `notAttempted`, `provides`
   (what each installed package brings), `dependencies` (`angular/skills` for `ng`, `dotnet/skills` for `dotnet`) and
   `notes`. Tell the user what was installed, which dependencies came along, and any failed or not-attempted package.
4. Relay the `notes` and follow [after install](references/after-install.md): what to commit, and the allowlist file of the harness with the verify commands of the repository's `AGENTS.md` for `/deliver`.

## Script inputs and output

- Inputs: `-Packages` (comma-separated; skips detection), `-Global`, `-DryRun`, `-Ref <tag|sha>` (appends `#<ref>` to every package spec and installs the apm-hub dependencies first at the same ref; without it installs track the default branch), `-TrustProject`.
- Without `-Packages` the script runs `detect-techstack` (also under `-DryRun`) from your home skill directories. A copy found only in the project is repository code and is not run unless `-TrustProject` is passed; ask the user before doing so in a repository they do not trust.
- Output is JSON on stdout: `dryRun`, `wouldInstall` or `installed`, `skipped`, `failed`, `notAttempted`, `commands`, `provides`, `dependencies`, `notes`. A failing `apm install` stops the run with exit 1.

## Missing prerequisites

`apm` missing: `curl -sSL https://aka.ms/apm-unix | sh` (macOS/Linux) or `winget install Microsoft.APM`. Do not install
tools for the user without asking.
