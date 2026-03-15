---
description: 'Interactive setup wizard: browse GravionLabs/copilot-hub, select relevant Instructions/Prompts/Agents, install them to .github/ and optionally to a global instructions directory, and generate a copilot-instructions.md'
mode: agent
tools: ['codebase', 'runCommands', 'editFiles']
model: gpt-4o-mini
---

> **IDE Compatibility:** ✅ Works in VS Code, JetBrains Copilot, and Copilot CLI.
> Requires `pwsh` (PowerShell Core) and the `gh` CLI installed and authenticated (`gh auth status`).
>
> **For ongoing sync of existing files:** Use `/gh-copilot-sync`.
>
> **Autopilot mode:** Append `--autopilot` to skip all confirmation prompts and run non-interactively:
> `/gh-copilot-setup --autopilot`
>
> **On startup:** Read this prompt's frontmatter. If a `model:` field is present, display this notice
> before proceeding (substituting the actual model value from the frontmatter):
>> ⚠️ **Model notice:** This prompt is configured for `{model}`. In **VS Code Copilot Chat** this
>> model override is applied automatically. When running via the **Copilot CLI**, the `model:`
>> frontmatter field is not respected — your CLI session model is used instead.
>
> Skip the notice if no `model:` field is set.

# GH Copilot Setup

Interactive wizard to bootstrap GitHub Copilot configuration for a repository.
Browses the `GravionLabs/copilot-hub` template library, lets you pick the right
Instructions, Prompts, and Agents, downloads them, creates the `.github/` directory
structure, and optionally generates a `copilot-instructions.md`.

## Autopilot Mode

When invoked with `--autopilot`, the agent skips all confirmation prompts and runs
non-interactively:

- Accepts all suggested template recommendations without asking
- Creates directories without confirmation
- Installs to the global instructions directory automatically (if `COPILOT_GLOBAL_INSTRUCTIONS_DIR` is set, otherwise skips global install)
- Skips the `copilot-instructions.md` generation step (use `--autopilot --with-instructions`
  to include it)
- Proceeds directly to the summary

**Usage examples:**

```
# Interactive (default) – asks before each step
/gh-copilot-setup

# Autopilot – no prompts, accept all suggestions
/gh-copilot-setup --autopilot

# Autopilot + generate copilot-instructions.md
/gh-copilot-setup --autopilot --with-instructions
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

Check that `pwsh` (PowerShell Core) and the `gh` CLI are available and authenticated:

```powershell
pwsh --version
gh --version
gh auth status
```

If `pwsh` is not found, stop and advise the user to install it:
- **macOS:** `brew install powershell`
- **Linux:** `sudo apt install powershell` (or see https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-linux)
- **Windows:** `winget install Microsoft.PowerShell`

If `gh` is not authenticated:

```powershell
gh auth login
```

Stop and report the issue if authentication cannot be established.

---

## Step 2: Analyze Local Project Stack

Scan the repository to determine the technology stack:

1. **Language detection**: check file extensions (`.cs`, `.py`, `.ts`, `.js`, `.tf`, etc.)
2. **Framework detection**: check config files (`*.csproj`, `package.json`, `requirements.txt`,
   `pyproject.toml`, `*.sln`, `angular.json`, `Dockerfile`, `*.tf`)
3. **CI/CD detection**: check `.github/workflows/`, `azure-pipelines*.yml`
4. **Test frameworks**: NUnit, xUnit, pytest, Jest, Playwright

Note: the `.github/` directory may not exist yet — that is expected.

---

## Step 3: Browse Available Templates

List all available templates from `GravionLabs/copilot-hub`:

```powershell
# List instructions
gh api /repos/GravionLabs/copilot-hub/contents/templates/instructions \
  --jq '[.[] | select(.type == "file") | .name]'

# List prompts
gh api /repos/GravionLabs/copilot-hub/contents/templates/prompts \
  --jq '[.[] | select(.type == "file") | .name]'

# List agents
gh api /repos/GravionLabs/copilot-hub/contents/templates/agents \
  --jq '[.[] | select(.type == "file") | .name]'
```

Present the full list grouped by category (Instructions / Prompts / Agents).

---

## Step 4: Suggest Templates

Based on the detected stack, suggest relevant templates and ask the user to confirm
or adjust the selection.

### Always include

- `instructions/security.instructions.md`

### C# / .NET projects

- Instructions: `csharp.instructions.md`, `dotnet-architecture-good-practices.instructions.md`
- Add if NUnit detected: `csharp-nunit.instructions.md`
- Add if ASP.NET detected: `aspnet-rest-apis.instructions.md`
- Add if Docker detected: `containerization-docker-best-practices.instructions.md`
- Prompts: `csharp-code-review.prompt.md`, `csharp-docs.prompt.md`, `dotnet-best-practices.prompt.md`, `write-tests.prompt.md`
- Agents: `csharp-expert.agent.md`, `test-engineer.agent.md`

### Python projects

- Instructions: `python.instructions.md`
- Add if pytest detected: `python-pytest.instructions.md`
- Prompts: `python-code-review.prompt.md`, `pytest-coverage.prompt.md`
- Agents: `test-engineer.agent.md`

### TypeScript / JavaScript projects

- Instructions: `typescript-mcp-server.instructions.md` (if MCP), or generic TypeScript
- Prompts: `code-review.prompt.md`, `write-tests.prompt.md`

### Infrastructure / DevOps

- Add if Terraform detected: `terraform.instructions.md`
- Add if Azure Pipelines detected: `azure-devops-pipelines.instructions.md`
- Agents: `devops-expert.agent.md`

### Generic (always useful)

- Prompts: `code-review.prompt.md`, `explain-code.prompt.md`, `refactor.prompt.md`
- Agents: `security-reviewer.agent.md`

Present the suggested list clearly and ask:
> "These templates have been suggested for your stack. Would you like to adjust the selection
> before downloading?"

Wait for confirmation before proceeding.

> **Autopilot mode:** Skip this confirmation – proceed immediately with the full suggested list.

---

## Step 5: Choose Installation Scope

Before creating any directories or downloading files, ask the user where templates should
be installed:

> "Where should the templates be installed?
> - **Local only** — `.github/` in this repository only (default)
> - **Global only** — `~/.github/` global base directory — instructions, prompts, and agents
>   stored in `~/.github/instructions/`, `~/.github/prompts/`, `~/.github/agents/`
> - **Both** — install to `.github/` and the global base directory"

> **Autopilot mode:** Use **Local only** unless `COPILOT_GLOBAL_BASE` is already set in
> the environment, in which case use **Both**.

Store the choice as `$InstallScope` (values: `local`, `global`, `both`) for use in Steps 6 and 7.

If `global` or `both` is chosen, determine the global base directory:

```powershell
$GlobalBase = if ($env:COPILOT_GLOBAL_BASE) { $env:COPILOT_GLOBAL_BASE } else { "$HOME/.github" }
$GlobalDirs = @{
    instructions = Join-Path $GlobalBase 'instructions'
    prompts      = Join-Path $GlobalBase 'prompts'
    agents       = Join-Path $GlobalBase 'agents'
}
```

---

## Step 6: Create Directory Structure

Create the required local directories if they do not exist:

```powershell
New-Item -ItemType Directory -Force -Path .github/instructions | Out-Null
New-Item -ItemType Directory -Force -Path .github/prompts | Out-Null
New-Item -ItemType Directory -Force -Path .github/agents | Out-Null
```

If `$InstallScope` is `global` or `both`, also create the global subdirectories:

```powershell
New-Item -ItemType Directory -Force -Path $GlobalDirs.instructions | Out-Null
New-Item -ItemType Directory -Force -Path $GlobalDirs.prompts | Out-Null
New-Item -ItemType Directory -Force -Path $GlobalDirs.agents | Out-Null
```

---

## Step 7: Download and Place Templates

For each confirmed file, download it from `GravionLabs/copilot-hub` and place it in the
correct directory based on `$InstallScope`:

```powershell
# Helper function: download one template file
function Download-Template {
    param(
        [string]$Category,    # instructions | prompts | agents
        [string]$Filename,
        [string]$DestDir
    )
    $DownloadUrl = gh api "/repos/GravionLabs/copilot-hub/contents/templates/$Category/$Filename" --jq '.download_url'
    Invoke-WebRequest -Uri $DownloadUrl -OutFile (Join-Path $DestDir $Filename)
}

# All three categories respect $InstallScope:
#   local  → .github/<category>/ only
#   global → $GlobalDirs.<category> only
#   both   → both directories

# Example for $InstallScope = "both":
Download-Template "instructions" "security.instructions.md" ".github/instructions"
Copy-Item ".github/instructions/security.instructions.md" $GlobalDirs.instructions

Download-Template "prompts" "code-review.prompt.md" ".github/prompts"
Copy-Item ".github/prompts/code-review.prompt.md" $GlobalDirs.prompts

Download-Template "agents" "csharp-expert.agent.md" ".github/agents"
Copy-Item ".github/agents/csharp-expert.agent.md" $GlobalDirs.agents
```

After the download, if `$InstallScope` is `global` or `both`, register the global
instructions directory with `COPILOT_CUSTOM_INSTRUCTIONS_DIRS`:

```powershell
$instrDir = $GlobalDirs.instructions
$dirs = if ($env:COPILOT_CUSTOM_INSTRUCTIONS_DIRS) {
    $env:COPILOT_CUSTOM_INSTRUCTIONS_DIRS -split [System.IO.Path]::PathSeparator
} else { @() }

if ($instrDir -notin $dirs) {
    if ($env:COPILOT_CUSTOM_INSTRUCTIONS_DIRS) {
        $env:COPILOT_CUSTOM_INSTRUCTIONS_DIRS += "$([System.IO.Path]::PathSeparator)$instrDir"
    } else {
        $env:COPILOT_CUSTOM_INSTRUCTIONS_DIRS = $instrDir
    }
    Write-Host "✅ Added $instrDir to COPILOT_CUSTOM_INSTRUCTIONS_DIRS (current session)"
}

Write-Host "ℹ️  To make this permanent, add to your PowerShell profile (`$PROFILE):"
Write-Host "   `$env:COPILOT_CUSTOM_INSTRUCTIONS_DIRS += '$([System.IO.Path]::PathSeparator)$instrDir'"
```

After each batch, confirm files were written:

```powershell
Get-ChildItem .github/instructions, .github/prompts, .github/agents -ErrorAction SilentlyContinue
```

---

## Step 8: Generate copilot-instructions.md (Optional)

Ask the user:
> "Would you like to create or update `.github/copilot-instructions.md` for this repository?"

> **Autopilot mode:** Skip this step unless `--with-instructions` was passed; then generate
> automatically without prompting.

If **yes**:

1. Read the project analysis from Step 2
2. Check if `.github/copilot-instructions.md` already exists
3. Generate a tailored `copilot-instructions.md` based on:
   - Project overview (detected languages, frameworks, architecture)
   - Code style hints derived from existing files
   - Security rules (from `security.instructions.md`)
   - Build & test commands (detected from config files)
   - Links to the installed instruction files under `.github/instructions/`

Use the template structure from `templates/copilot-instructions.md` as a base.
Place the result at `.github/copilot-instructions.md`.

---

## Step 9: Summary

Print a summary of everything that was done:

```
✅ GH Copilot Setup Complete
───────────────────────────────
Instructions:
  .github/instructions/security.instructions.md
  .github/instructions/csharp.instructions.md
  ...

Prompts:
  .github/prompts/code-review.prompt.md
  ...

Agents:
  .github/agents/csharp-expert.agent.md
  ...

Global base (~/.github):
  ✅ installed (both)  /  ✅ global only  /  ⬜ local only
  COPILOT_CUSTOM_INSTRUCTIONS_DIRS: ✅ registered / ⬜ not set

copilot-instructions.md: ✅ created / ⬜ skipped

Next step: Run /gh-copilot-sync to keep these files up to date.
```

---

## Error Handling

- If `gh auth status` fails: run `gh auth login` and retry
- If a file download fails (HTTP error): skip it, note it in the summary, continue with the next
- If directory creation fails: report and stop (file system permissions issue)
- If `.github/copilot-instructions.md` already exists: ask before overwriting
