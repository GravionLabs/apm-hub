---
name: apm-install
description: '/apm-install: detect the stack and install the matching apm-hub packages into this project or globally (-g). Use for "install apm-hub", "set up the skills here".'
disable-model-invocation: true
user-invocable: true
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
`github`, `delivery`, `agents`, `hooks`, `core`, `all`, `ts`, `py`, `ng`, `dotnet`; anything else makes the script exit 1.
The contributor tooling package is not offered. What each package brings: [packages](references/packages.md).

## Steps

1. Always run a dry run first and show the user the proposal (the `commands` list, `skipped`, `notes`):

   ```powershell
   pwsh scripts/Install-HubPackages.ps1 -DryRun                    # detect, propose
   pwsh scripts/Install-HubPackages.ps1 -DryRun -Packages ts,py    # explicit packages
   pwsh scripts/Install-HubPackages.ps1 -DryRun -Packages core -Global
   ```

2. Ask for confirmation. Never install without it, even when the packages were named in the slash command.
3. Run the same command without `-DryRun`. Print the JSON summary `{installed, skipped, commands, notes}`.
4. Relay the `notes` and follow [after install](references/after-install.md): `apmw sanitize` for agents, the OpenCode
   plugin copy, what to commit.

## Behavior of the script

- Without `-Packages` it runs `detect-techstack` (looked up in the project's, then your home skill directories) and maps
  typescript/javascript to `ts`, python to `py`, csharp to `dotnet` and angular to `ng`.
- `detect-techstack` not installed: it falls back to the base packages `shared`, `github`, `delivery` and adds a note
  asking for `-Packages`. Ask the user which stack packages they want, or suggest installing `shared` first and running
  `/apm-install` again.
- The base packages are added only when the global client skill directories do not already hold them.
- Packages already listed in the manifest (`apm.yml`, or `~/.apm/apm.yml` with `-Global`) land in `skipped`: it only
  installs what is missing.
- A failing `apm install` stops the run: exit 1 and a note naming the package.
- Dependencies on `dotnet/skills` and `angular/skills` come with `dotnet` and `ng`; no separate step.

## Missing prerequisites

`apm` missing: `curl -sSL https://aka.ms/apm-unix | sh` (macOS/Linux) or `winget install Microsoft.APM`. `apmw` is
needed only for agent packages, see [after install](references/after-install.md). Do not install tools for the user
without asking.
