<#
.SYNOPSIS
    Scaffold an AGENTS.md file from a project-type template.

.DESCRIPTION
    Copies a template from GravionLabs/apm-hub (templates/agents-md/) to the
    specified output path. Supports five project types: generic, dotnet, node,
    python, and github-actions.

    When -Type is not provided, the script auto-detects the project type by
    inspecting files in the current directory.

    Requires: pwsh (PowerShell Core), gh CLI (authenticated) — or a local
    copy of the apm-hub repository.

.PARAMETER Type
    Project type to use as template basis.
    Accepted values: generic, dotnet, node, python, github-actions
    If omitted, the script auto-detects the type.

.PARAMETER OutputPath
    Destination path for the generated AGENTS.md.
    Defaults to ./AGENTS.md in the current directory.

.PARAMETER SourceRepo
    GitHub repository to fetch templates from.
    Defaults to GravionLabs/apm-hub.

.PARAMETER LocalSource
    Path to a local apm-hub clone. When provided, templates are read
    from disk instead of fetched via the gh CLI.

.PARAMETER Force
    Overwrite an existing AGENTS.md without prompting.

.EXAMPLE
    pwsh scripts/New-AgentsMd.ps1

.EXAMPLE
    pwsh scripts/New-AgentsMd.ps1 -Type dotnet

.EXAMPLE
    pwsh scripts/New-AgentsMd.ps1 -Type node -OutputPath ./my-project/AGENTS.md

.EXAMPLE
    pwsh scripts/New-AgentsMd.ps1 -LocalSource ../apm-hub -Type python
#>
[CmdletBinding()]
param(
    [ValidateSet('generic', 'dotnet', 'node', 'python', 'github-actions')]
    [string] $Type,

    [string] $OutputPath = './AGENTS.md',

    [string] $SourceRepo = 'GravionLabs/apm-hub',

    [string] $LocalSource,

    [switch] $Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Step([string] $Message) {
    Write-Host "  $Message" -ForegroundColor Cyan
}

function Write-Success([string] $Message) {
    Write-Host "  ✓ $Message" -ForegroundColor Green
}

function Write-Warning2([string] $Message) {
    Write-Host "  ! $Message" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# Auto-detect project type
# ---------------------------------------------------------------------------

function Get-ProjectType([string] $SearchPath) {
    $files = Get-ChildItem -Path $SearchPath -Recurse -Depth 2 -File -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty Name

    $hasWorkflows = Test-Path (Join-Path $SearchPath '.github/workflows')
    $hasActionYml = Get-ChildItem -Path $SearchPath -Recurse -Depth 3 -Filter 'action.yml' -ErrorAction SilentlyContinue

    if ($hasWorkflows -and $hasActionYml) { return 'github-actions' }
    if ($files -match '\.(csproj|sln|slnx)$' -or (Test-Path (Join-Path $SearchPath 'global.json'))) { return 'dotnet' }
    if ($files -contains 'package.json') { return 'node' }
    if ($files -match '(pyproject\.toml|setup\.py|requirements\.txt|uv\.lock)') { return 'python' }

    return 'generic'
}

# ---------------------------------------------------------------------------
# Fetch template content
# ---------------------------------------------------------------------------

function Get-TemplateContent([string] $ProjectType) {
    $templatePath = "templates/agents-md/$ProjectType.md"

    if ($LocalSource) {
        $fullPath = Join-Path $LocalSource $templatePath
        if (-not (Test-Path $fullPath)) {
            throw "Template not found at: $fullPath"
        }
        Write-Step "Reading template from local source: $fullPath"
        return Get-Content -Path $fullPath -Raw
    }

    Write-Step "Fetching template from $SourceRepo ..."
    $content = gh api "repos/$SourceRepo/contents/$templatePath" --jq '.content' 2>$null
    if (-not $content) {
        throw "Could not fetch template '$templatePath' from $SourceRepo. Is 'gh' authenticated?"
    }

    # GitHub API returns base64-encoded content
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(($content -replace '\s', '')))
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

$targetPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))

Write-Host ''
Write-Host 'New-AgentsMd.ps1' -ForegroundColor White
Write-Host '----------------' -ForegroundColor DarkGray
Write-Host ''

# Detect or validate type
if (-not $Type) {
    $searchDir = Split-Path $targetPath -Parent
    Write-Step "Auto-detecting project type in: $searchDir"
    $Type = Get-ProjectType -SearchPath $searchDir
    Write-Success "Detected type: $Type"
} else {
    Write-Success "Using type: $Type"
}

# Check for existing file
if (Test-Path $targetPath) {
    if (-not $Force) {
        Write-Warning2 "AGENTS.md already exists at: $targetPath"
        $answer = Read-Host '  Overwrite? [y/N]'
        if ($answer -notin @('y', 'Y')) {
            Write-Host '  Aborted.' -ForegroundColor Red
            exit 0
        }
    } else {
        Write-Warning2 "Overwriting existing file (--Force): $targetPath"
    }
}

# Fetch template
$templateContent = Get-TemplateContent -ProjectType $Type

# Write output
$outputDir = Split-Path $targetPath -Parent
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Set-Content -Path $targetPath -Value $templateContent -Encoding UTF8 -NoNewline

Write-Host ''
Write-Success "AGENTS.md created at: $targetPath"
Write-Host ''
Write-Host '  Next steps:' -ForegroundColor White
Write-Host "  1. Open $targetPath and fill in the placeholders." -ForegroundColor Gray
Write-Host '  2. Remove any sections that do not apply.' -ForegroundColor Gray
Write-Host '  3. Commit the file to the repository root.' -ForegroundColor Gray
Write-Host ''
Write-Host '  Tip: Use the /create-agents-md Copilot skill to auto-fill the template.' -ForegroundColor DarkGray
Write-Host ''
