<#
.SYNOPSIS
  Sanitizes OpenCode agent frontmatter. Strips or converts Copilot-style
  `tools: [...]` arrays that OpenCode rejects at startup.

.DESCRIPTION
  Default mode: scans `.opencode/agents/*.md` and strips Copilot-only fields
  that crash OpenCode. Source `.agent.md` files are NOT modified by default
  so Copilot deployments keep their `tools: [...]` field.

  Use `-Source` to also add `permission:` to source `.agent.md` files
  (preserves `tools` for Copilot).

  Idempotent — safe to run multiple times.

.PARAMETER Path
  Project root directory. Defaults to current directory.

.PARAMETER Source
  Also fix source `.agent.md` files under `packages/*/.apm/agents/`.
  Adds `permission:` derived from `tools: [...]` but preserves `tools` so
  Copilot deployments still work.

.PARAMETER WhatIf
  Show what would change without modifying files.
#>
param(
  [string]$Path = (Get-Location),
  [switch]$Source,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

$changed = 0
$skipped = 0

function Edit-Frontmatter {
  param(
    [string]$FilePath,
    [switch]$StripCopilotOnly,
    [switch]$ConvertTools
  )

  $fileName = Split-Path $FilePath -Leaf
  $lines = Get-Content $FilePath
  if ($lines.Count -lt 3 -or $lines[0] -ne '---') {
    Write-Host "  [skip]    $fileName — no frontmatter" -ForegroundColor DarkGray
    return $false
  }

  # Find closing ---
  $closingIdx = -1
  for ($i = 1; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -eq '---') { $closingIdx = $i; break }
  }
  if ($closingIdx -lt 0) { return $false }

  # Frontmatter lines (indices 1 to closingIdx-1)
  $fmLines = $lines[1..($closingIdx - 1)]
  $bodyLines = $lines[($closingIdx + 1)..($lines.Count - 1)]
  $originalCount = $fmLines.Count

  # Detect array-form tools
  $hasArrayTools = $false
  $toolNames = @()
  for ($i = 0; $i -lt $fmLines.Count; $i++) {
    $line = $fmLines[$i]
    if ($line -match '^tools:\s*\[') {
      $hasArrayTools = $true
      # Extract names from inline array: tools: ['a', 'b']
      $m = [regex]::Match($line, '^tools:\s*\[(.*)\]')
      if ($m.Success) {
        $toolNames = $m.Groups[1].Value -split ',' | ForEach-Object { $_.Trim().Trim("'").Trim('"') }
      }
      break
    }
    if ($line -match '^tools:\s*$') {
      $hasArrayTools = $true
      # Extract names from block-list
      for ($j = $i + 1; $j -lt $fmLines.Count; $j++) {
        $nested = $fmLines[$j]
        if ($nested -match '^\s+-\s+(.*)') { $toolNames += $matches[1].Trim() }
        else { break }
      }
      break
    }
  }

  if (-not $hasArrayTools) { return $false }

  if ($StripCopilotOnly) {
    # Remove Copilot-only lines from frontmatter
    $newFm = @()
    $skipBlockList = $false
    foreach ($line in $fmLines) {
      if ($skipBlockList) {
        if ($line -match '^\s+- ') { continue }
        $skipBlockList = $false
      }
      if ($line -match '^tools:\s*\[') { continue }
      if ($line -match '^tools:\s*$') { $skipBlockList = $true; continue }
      if ($line -match '^user-invocable:\s*(true|false)') { continue }
      $newFm += $line
    }
    $fmLines = $newFm
    if ($fmLines.Count -eq $originalCount) { return $false }
    Write-Host "  [strip]   $fileName — removed tools array" -ForegroundColor DarkGray
  }
  elseif ($ConvertTools) {
    # Check if permission already exists
    $hasPermission = $false
    foreach ($line in $fmLines) {
      if ($line -match '^permission:') { $hasPermission = $true; break }
    }
    if ($hasPermission) { return $false }
    if ($toolNames.Count -eq 0) { return $false }

    # Add permission block before # Copilot/APM fields comment, or at end
    $permBlock = @("permission:")
    foreach ($name in $toolNames) { $permBlock += "  $($name): allow" }

    $insertAt = -1
    for ($i = 0; $i -lt $fmLines.Count; $i++) {
      if ($fmLines[$i] -match '^# Copilot/APM fields') { $insertAt = $i; break }
    }
    if ($insertAt -ge 0) {
      $fmLines = $fmLines[0..($insertAt - 1)] + $permBlock + $fmLines[$insertAt..($fmLines.Count - 1)]
    }
    else {
      $fmLines += $permBlock
    }
    Write-Host "  [convert] $fileName — added permission ($($toolNames -join ', '))" -ForegroundColor Cyan
  }

  # Reconstruct file
  $newLines = @('---') + $fmLines + @('---') + $bodyLines
  if ($WhatIf) {
    Write-Host "  [whatif]  $fileName — would update" -ForegroundColor Magenta
  }
  else {
    Set-Content $FilePath -NoNewline -Value ($newLines -join "`n")
  }
  return $true
}

# ── Main ────────────────────────────────────────────────────────────

$opencodeDir = Join-Path $Path '.opencode/agents'
if (Test-Path $opencodeDir) {
  $files = Get-ChildItem "$opencodeDir/*.md"
  foreach ($file in $files) {
    if (Edit-Frontmatter $file.FullName -StripCopilotOnly) { $changed++ } else { $skipped++ }
  }
}

if ($Source) {
  $packagesDir = Join-Path $Path 'packages'
  if (Test-Path $packagesDir) {
    $files = Get-ChildItem "$packagesDir/*/.apm/agents/*.agent.md"
    foreach ($file in $files) {
      if (Edit-Frontmatter $file.FullName -ConvertTools) { $changed++ } else { $skipped++ }
    }
  }
}

Write-Host ""
Write-Host "Done: $changed changed, $skipped skipped" -ForegroundColor Green
