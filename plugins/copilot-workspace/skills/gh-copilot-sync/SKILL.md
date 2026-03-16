---
name: gh-copilot-sync
description: 'Sync all existing .github/instructions, .github/prompts, and .github/agents files with the latest versions from GravionLabs/copilot-hub. Also syncs the global base directory (~/.github) if configured. Checks for newly available templates.'
---

> **IDE Compatibility:** ✅ Works in VS Code, JetBrains Copilot, and Copilot CLI.
> Requires `pwsh` (PowerShell Core) and the `gh` CLI installed and authenticated (`gh auth status`).
>
> **First-time setup?** Use `/gh-copilot-setup` instead.
>
> **Autopilot mode:** Append `--autopilot` to apply all updates without confirmation:
> `/gh-copilot-sync --autopilot`
>
> **On startup:** Read this prompt's frontmatter. If a `model:` field is present, display this notice
> before proceeding (substituting the actual model value from the frontmatter):
>> ⚠️ **Model notice:** This prompt is configured for `{model}`. In **VS Code Copilot Chat** this
>> model override is applied automatically. When running via the **Copilot CLI**, the `model:`
>> frontmatter field is not respected — your CLI session model is used instead.
>
> Skip the notice if no `model:` field is set.

# GH Copilot Sync

Keeps an existing `.github/` Copilot configuration up to date with the latest template
versions from `GravionLabs/copilot-hub`. Works for all three categories: **instructions,
prompts, and agents** — both locally (`.github/`) and in the optional global base directory
(`~/.github` by default). Also reports new templates available in copilot-hub that you
haven't installed yet.

The heavy lifting is done by `copilot-sync.ps1`, a standalone PowerShell script that this
prompt downloads and runs. You can also run it directly at any time:

```
pwsh .github/scripts/copilot-sync.ps1
```

## Flags

| Flag | Description |
|------|-------------|
| `--autopilot` | Skip all confirmations, apply updates immediately |
| `--force` | Overwrite all files, even unchanged ones |
| `--dry-run` | Show what would change without writing any files |
| `--global-base <path>` | Override global base dir (default: `~/.github`) |
| `--skip-new` | Skip the check for newly available templates |
| `--install-new` | Automatically install all newly found templates |

## Usage

```
# Interactive (default) – shows diff summary, asks before applying
/gh-copilot-sync

# Autopilot – apply all updates without confirmation
/gh-copilot-sync --autopilot

# Force-sync all files unconditionally
/gh-copilot-sync --autopilot --force

# Preview only – no changes written
/gh-copilot-sync --dry-run

# Autopilot + also install new templates
/gh-copilot-sync --autopilot --install-new
```

---

## Source Repository (fixed)

| Setting   | Value                      |
| --------- | -------------------------- |
| Host      | GitHub                     |
| Repo      | `GravionLabs/copilot-hub`  |
| Branch    | `main`                     |
| Templates | `templates/`               |

---

## Step 1: Prerequisites

Verify that `pwsh` (PowerShell Core) and the `gh` CLI are available and authenticated:

```powershell
pwsh --version
gh --version
gh auth status
```

If `pwsh` is not found, stop and advise the user to install it:
- **macOS:** `brew install powershell`
- **Linux:** `sudo apt install powershell` (or see https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-linux)
- **Windows:** `winget install Microsoft.PowerShell`

Stop and report if `gh` authentication is not available.

---

## Step 2: Download the Sync Script

Download the latest `copilot-sync.ps1` from `GravionLabs/copilot-hub` to `.github/scripts/`.
Always re-download to ensure the latest version is used.

```powershell
New-Item -ItemType Directory -Force -Path .github/scripts | Out-Null
$ScriptUrl = gh api /repos/GravionLabs/copilot-hub/contents/scripts/copilot-sync.ps1 `
    --jq '.download_url'
Invoke-WebRequest -Uri $ScriptUrl -OutFile .github/scripts/copilot-sync.ps1
```

If the download fails, stop and report the error.

---

## Step 3: Run the Sync Script

Run the script, mapping the user-provided flags to script parameters:

| User flag | Script parameter |
|-----------|-----------------|
| `--autopilot` | `-Autopilot` |
| `--force` | `-Force` |
| `--dry-run` | `-DryRun` |
| `--global-base <path>` | `-GlobalBase <path>` |
| `--skip-new` | `-SkipNew` |
| `--install-new` | `-InstallNew` |

```powershell
# Example: interactive run
pwsh .github/scripts/copilot-sync.ps1

# Example: autopilot + install new templates
pwsh .github/scripts/copilot-sync.ps1 -Autopilot -InstallNew

# Example: dry run
pwsh .github/scripts/copilot-sync.ps1 -DryRun
```

The script handles all discovery, comparison, update, and new-template detection.
Capture and display its full output to the user.

---

## Step 4: Final Summary

After the script completes, present a brief summary of the outcome:

- How many files were updated / unchanged / skipped
- Whether any new templates were reported or installed
- Whether changes are ready to commit

If the script exited with a non-zero code, report the error and suggest remediation
(e.g., `gh auth login` for auth failures, permission check for write failures).

---

## Error Handling

- **Script download fails:** check `gh auth status`; retry or run `gh auth login`
- **Auth error inside script:** run `gh auth login` and retry
- **Write permission error:** script reports and stops; do not apply partial updates
- **404 for a template file:** custom file not in copilot-hub — script skips and warns automatically
