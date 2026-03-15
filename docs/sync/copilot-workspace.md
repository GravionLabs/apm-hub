# copilot-workspace Plugin

The `copilot-workspace` plugin is the recommended way to set up and maintain GitHub Copilot
configuration across your repositories. It provides two interactive skills and a standalone
PowerShell script that work together to bootstrap and keep your `.github/` configuration in
sync with the latest templates from `GravionLabs/copilot-hub`.

---

## Quick Start

```bash
# Install the plugin once
gh copilot plugin install GravionLabs/copilot-hub:plugins/copilot-workspace

# Or via the marketplace (if copilot-hub is registered)
gh copilot plugin install copilot-workspace@copilot-hub
```

Then, in any repository you want to configure:

```
# First-time setup — interactive wizard
/gh-copilot-setup

# Keep templates up to date
/gh-copilot-sync
```

---

## Skills

### `gh-copilot-setup` — Interactive Setup Wizard

**Invoke:** `/gh-copilot-setup`

Bootstraps a repository's GitHub Copilot configuration from scratch. The wizard:

1. **Checks prerequisites** — verifies `pwsh` (PowerShell Core) and the `gh` CLI are installed and authenticated.
2. **Analyzes the project stack** — detects languages (`.cs`, `.py`, `.ts`, …), frameworks (`*.csproj`, `pyproject.toml`, `angular.json`, …), CI/CD, and test frameworks.
3. **Browses available templates** — lists all instructions, prompts, and agents from `GravionLabs/copilot-hub`.
4. **Suggests relevant templates** — proposes a curated selection based on the detected stack.
5. **Asks where to install** — local only (`.github/`), global only (`~/.github/`), or both.
6. **Creates directory structure** — `.github/instructions/`, `.github/prompts/`, `.github/agents/`.
7. **Downloads and places templates** — fetches each selected file via the GitHub API.
8. **Optionally generates `copilot-instructions.md`** — a tailored `copilot-instructions.md` for the repository.
9. **Prints a summary** — lists all installed files and any next steps.

#### Flags

| Flag | Description |
|------|-------------|
| *(none)* | Interactive mode — confirms each step before proceeding |
| `--autopilot` | Skip all confirmations, accept all suggestions, proceed non-interactively |
| `--autopilot --with-instructions` | Autopilot mode and also generate `copilot-instructions.md` automatically |

#### Usage examples

```
# Interactive (default) — asks before each step
/gh-copilot-setup

# Autopilot — no prompts, accept all suggestions
/gh-copilot-setup --autopilot

# Autopilot + generate copilot-instructions.md
/gh-copilot-setup --autopilot --with-instructions
```

#### Stack-based suggestions

| Stack | Suggested templates |
|-------|-------------------|
| Always | `instructions/security.instructions.md` |
| C# / .NET | `csharp.instructions.md`, `dotnet-architecture-good-practices.instructions.md`, prompts: `csharp-code-review`, `dotnet-best-practices`, agents: `csharp-expert` |
| + NUnit | `csharp-nunit.instructions.md` |
| + ASP.NET | `aspnet-rest-apis.instructions.md` |
| Python | `python.instructions.md`, prompts: `python-code-review`, `pytest-coverage` |
| TypeScript / JS | `typescript-mcp-server.instructions.md` (if MCP), prompts: `code-review`, `write-tests` |
| Terraform | `terraform.instructions.md` |
| Generic | `code-review.prompt.md`, `explain-code.prompt.md`, agents: `security-reviewer` |

---

### `gh-copilot-sync` — Sync Installed Templates

**Invoke:** `/gh-copilot-sync`

Keeps an existing `.github/` configuration up to date with the latest template versions
from `GravionLabs/copilot-hub`. Works across all three categories (instructions, prompts,
agents) for both local (`.github/`) and global (`~/.github/`) installations. Also reports
newly available templates that you haven't installed yet.

The skill downloads the latest `copilot-sync.ps1` from copilot-hub and runs it, so the
sync logic is always current even if the plugin itself hasn't been updated.

#### Flags

| Flag | Description |
|------|-------------|
| *(none)* | Interactive mode — shows diff summary, asks before applying updates |
| `--autopilot` | Skip all confirmations, apply all updates immediately |
| `--force` | Overwrite all files unconditionally, even if unchanged |
| `--dry-run` | Show what would change without writing any files |
| `--global-base <path>` | Override the global base directory (default: `~/.github`) |
| `--skip-new` | Skip the check for newly available templates in copilot-hub |
| `--install-new` | Automatically install all newly discovered templates |

#### Usage examples

```
# Interactive (default) — shows diff, asks before applying
/gh-copilot-sync

# Autopilot — apply all updates without confirmation
/gh-copilot-sync --autopilot

# Force-sync all files unconditionally
/gh-copilot-sync --autopilot --force

# Preview only — no changes written
/gh-copilot-sync --dry-run

# Autopilot + also install newly available templates
/gh-copilot-sync --autopilot --install-new
```

---

## Standalone Script: `copilot-sync.ps1`

The plugin ships `copilot-sync.ps1` — a standalone PowerShell Core script that performs
the same sync operation as `/gh-copilot-sync`, but can be run directly, scheduled via CI,
or included in automation pipelines without requiring the Copilot CLI or an AI session.

When `/gh-copilot-sync` runs, it always downloads the latest version of this script before
executing it. You can also run it directly at any time once it has been installed:

```powershell
pwsh .github/scripts/copilot-sync.ps1
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `-Autopilot` | switch | Skip all confirmation prompts, apply updates immediately |
| `-Force` | switch | Overwrite all files unconditionally, even if unchanged |
| `-DryRun` | switch | Show what would change without writing any files |
| `-GlobalBase <path>` | string | Override the global base directory (default: `$HOME/.github` or `$env:COPILOT_GLOBAL_BASE`) |
| `-SkipNew` | switch | Skip the check for new templates not yet installed |
| `-InstallNew` | switch | Automatically install all newly discovered templates |

### What the script does

1. **Discovers installed files** — scans `.github/instructions/`, `.github/prompts/`, `.github/agents/`, and the optional global base directory.
2. **Fetches remote versions** — downloads each discovered file from `GravionLabs/copilot-hub` via the GitHub API.
3. **Compares content** — marks each file as `UNCHANGED`, `UPDATED`, or `NOT_FOUND` (custom files not in copilot-hub are skipped with a warning).
4. **Applies updates** — respects the install scope (`local`, `global`, or `both`) of each file.
5. **Checks for new templates** — lists any templates in copilot-hub that aren't installed locally or globally.
6. **Prints a summary** — counts of updated/unchanged/skipped files and a commit tip.

### Examples

```powershell
# Interactive run (asks before applying)
pwsh .github/scripts/copilot-sync.ps1

# Apply all updates without confirmation
pwsh .github/scripts/copilot-sync.ps1 -Autopilot

# Dry run — preview changes only
pwsh .github/scripts/copilot-sync.ps1 -DryRun

# Force overwrite everything
pwsh .github/scripts/copilot-sync.ps1 -Autopilot -Force

# Install newly available templates automatically
pwsh .github/scripts/copilot-sync.ps1 -Autopilot -InstallNew

# Use a custom global base directory
pwsh .github/scripts/copilot-sync.ps1 -GlobalBase ~/.config/copilot
```

### Running via CI

You can schedule `copilot-sync.ps1` as a GitHub Actions workflow to keep your repository
automatically up to date:

```yaml
name: Sync Copilot Templates

on:
  schedule:
    - cron: '0 2 * * 1'  # Every Monday at 02:00 UTC
  workflow_dispatch:

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download latest copilot-sync.ps1
        run: |
          mkdir -p .github/scripts
          gh api /repos/GravionLabs/copilot-hub/contents/templates/scripts/copilot-sync.ps1 \
            --jq '.download_url' | xargs curl -sSL -o .github/scripts/copilot-sync.ps1
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Sync templates
        run: pwsh .github/scripts/copilot-sync.ps1 -Autopilot
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .github/
          git diff --staged --quiet || git commit -m "chore: sync Copilot templates from copilot-hub"
          git push
```

---

## When to Use What

| Scenario | Recommended approach |
|----------|---------------------|
| First-time setup of a new repository | `/gh-copilot-setup` |
| Manually updating templates in an existing repo | `/gh-copilot-sync` |
| Previewing what would change | `/gh-copilot-sync --dry-run` |
| Keeping a repository updated on a schedule | `copilot-sync.ps1` via CI |
| Running without an AI session | `pwsh .github/scripts/copilot-sync.ps1` directly |
| Non-interactive scripting / pipelines | `copilot-sync.ps1 -Autopilot` |
