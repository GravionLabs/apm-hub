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
`github`, `delivery`, `agents`, `hooks`, `core`, `all`, `ts`, `py`, `ng`, `dotnet`, `rust`; anything else makes the script exit 1.
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
   A project install then runs `Enable-Worktrees.ps1` (apply mode, `detect-techstack/scripts/`): it makes `.gitignore` and the
   stack configs ignore `.worktrees/` and the result lists the changed files and open hints under `worktrees`. Tell the user
   to commit those files (not with `-Global`; a dry run lists the script as a step).
4. Relay the `notes` and `sanitized` and follow [after install](references/after-install.md): the script ran
   `apmw sanitize` for agents (or says why not), what to commit.

## Behavior of the script

- Detection runs a script: without `-Packages` it runs `detect-techstack`, even under `-DryRun`. It looks in your home
  skill directories first. A copy found only in the project is repository code and is not run unless you pass
  `-TrustProject`; ask the user before doing so in a repository they do not trust.
- The report maps `ts`/`js` to `ts`, `py` to `py`, `dotnet` to `dotnet`, `rust` to `rust`, and the `angular` framework to `ng`.
- `detect-techstack` missing, failing or printing invalid output: the missing ones of `shared`, `github`, `delivery` and a note
  asking for `-Packages`. Ask the user which stack packages they want.
- `-Global` without `-Packages` proposes only the base packages, with no stack detection; stack packages need `-Packages`.
  Each base package is checked separately (`shared` via `detect-techstack`, `github` via `github-issue`, `delivery` via
  `issue-planning`) and only the missing ones are proposed.
- Installed state comes from the manifest (`apm.yml`, `~/.apm/apm.yml` with `-Global`; comments ignored, `core` and `all`
  cover their members, `<pkg>@apm-hub` is recognised) and from `apm_modules/`. Those packages land in `skipped`.
- No `apm.yml` yet: `apm install` creates it; the script only notes it.
- A failing `apm install` stops the run: exit 1, `failed` names the package, `notAttempted` the rest.
- `-DryRun` reports `wouldInstall`, never `installed`; install-only notes read "After install: ...".
- The script uses the direct form `apm install GravionLabs/apm-hub/packages/<pkg>`, not `apm marketplace add` or
  `<pkg>@apm-hub`, because it needs no registration step.
- Installs track the default branch. `-Ref <tag|sha>` appends `#<ref>` to every package spec to pin one.
- `-Packages` accepts comma-separated names (whitespace and empty entries ignored; an empty list exits 1). A requested
  `core` or `all` covers its members: they are not installed next to it.
- `apm` output goes to stderr, so stdout is pure JSON.
- Hardening beyond the original task: the `-TrustProject` gate for a project-local `detect-techstack`, and `-Global`
  without `-Packages` proposing only the missing base packages, were added on purpose.

## Missing prerequisites

`apm` missing: `curl -sSL https://aka.ms/apm-unix | sh` (macOS/Linux) or `winget install Microsoft.APM`. `apmw` is
needed for agent packages (`agents`, `core`, `all`): the script installs without it but the agents then stay in the
source format (Claude Code starts them without tools), see [after install](references/after-install.md). Do not install
tools for the user without asking.
