<#
.SYNOPSIS
  One-time, idempotent repository onboarding for `.worktrees/` (git worktrees under the repository root).

.DESCRIPTION
  Makes .gitignore and the stack configs ignore `.worktrees/`:
  - .gitignore: appends `.worktrees/` when `git check-ignore -q .worktrees/x` fails (creates the file when missing).
  - biome.json: sets vcs.enabled, vcs.clientKind=git, vcs.useIgnoreFile=true, then `biome format --write` (node_modules/.bin).
  - .dockerignore: appends `.worktrees/` when present and not listed.
  - Vitest (stack reports vitest): writes a probe test under .worktrees/__probe__, runs `vitest list`, removes the probe;
    a listed probe yields a hint with the exclude snippet (the config is never patched).
  - eslint.config.*: hint only.
  The stack comes from Detect-TechStack.ps1 output; nothing is re-detected.
  -Check changes nothing and exits 1 when a change or hint is pending.

.PARAMETER Root
  Repository root. Default: `git rev-parse --show-toplevel` of the current directory.

.PARAMETER TechStack
  Path to the tech-stack JSON, a JSON string or an object. A tool counts as present when the property
  (`vitest`, `biome`) is true / non-empty or the name appears in a `tools`, `frameworks` or `test` list.

.OUTPUTS
  JSON { root, changed: [path], hints: [{file, message, snippet}], ok }.
#>
param(
  [string]$Root,
  $TechStack,
  [switch]$Check
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $Root) {
  $Root = "$(& git rev-parse --show-toplevel 2>$null)".Trim()
  if ($LASTEXITCODE -ne 0 -or -not $Root) { Write-Error 'Not inside a git repository and no -Root given.'; exit 2 }
}
if (-not (Test-Path -LiteralPath $Root -PathType Container)) { Write-Error "Root '$Root' is not a directory."; exit 2 }
$Root = (Resolve-Path -LiteralPath $Root).Path

$stack = $null
if ($TechStack -is [string] -and $TechStack.Trim()) {
  $raw = if (Test-Path -LiteralPath $TechStack -PathType Leaf) { Get-Content -LiteralPath $TechStack -Raw } else { $TechStack }
  $stack = $raw | ConvertFrom-Json
} elseif ($null -ne $TechStack -and $TechStack -isnot [string]) {
  $stack = $TechStack
}

function Get-PropName($Obj) { @($Obj.PSObject.Properties | ForEach-Object { $_.Name }) }

function Test-StackTool([string]$Name) {
  if ($null -eq $stack) { return $false }
  $props = @(Get-PropName $stack)
  if ($props -contains $Name) { return [bool]$stack.$Name }
  foreach ($list in 'tools', 'frameworks', 'test') {
    if ($props -contains $list -and @($stack.$list) -contains $Name) { return $true }
  }
  $false
}

$changed = [System.Collections.Generic.List[string]]::new()
$hints = [System.Collections.Generic.List[object]]::new()
function Add-Hint([string]$File, [string]$Message, [string]$Snippet = '') {
  $hints.Add([ordered]@{ file = $File; message = $Message; snippet = $Snippet })
}

function Add-IgnoreLine([string]$Path) {
  $text = if (Test-Path -LiteralPath $Path) { [IO.File]::ReadAllText($Path) } else { '' }
  if ($text.Length -gt 0 -and -not $text.EndsWith("`n")) { $text += "`n" }
  [IO.File]::WriteAllText($Path, $text + ".worktrees/`n")
}

function Get-Bin([string]$Name) {
  foreach ($n in $Name, "$Name.cmd") {
    $p = Join-Path $Root "node_modules/.bin/$n"
    if (Test-Path -LiteralPath $p -PathType Leaf) { return $p }
  }
  $null
}

# --- .gitignore ---
& git -C $Root check-ignore -q .worktrees/x 2>$null
if ($LASTEXITCODE -ne 0) {
  $changed.Add('.gitignore')
  if (-not $Check) { Add-IgnoreLine (Join-Path $Root '.gitignore') }
}

# --- .dockerignore ---
$dockerignore = Join-Path $Root '.dockerignore'
if (Test-Path -LiteralPath $dockerignore -PathType Leaf) {
  $listed = @(Get-Content -LiteralPath $dockerignore | ForEach-Object { $_.Trim() }) -match '^/?\.worktrees(/(\*\*)?)?$'
  if (-not $listed) {
    $changed.Add('.dockerignore')
    if (-not $Check) { Add-IgnoreLine $dockerignore }
  }
}

# --- biome.json ---
$biomeFile = Join-Path $Root 'biome.json'
if (Test-Path -LiteralPath $biomeFile -PathType Leaf) {
  $cfg = $null
  try { $cfg = Get-Content -LiteralPath $biomeFile -Raw | ConvertFrom-Json -Depth 20 } catch { $cfg = $null }
  if ($null -eq $cfg) {
    Add-Hint 'biome.json' 'biome.json could not be parsed; set vcs.enabled, vcs.clientKind and vcs.useIgnoreFile by hand.' '"vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true }'
  } else {
    $vcs = if ((Get-PropName $cfg) -contains 'vcs') { $cfg.vcs } else { $null }
    $get = { param($o, $n) if ($null -ne $o -and (Get-PropName $o) -contains $n) { $o.$n } else { $null } }
    $vcsOk = ((& $get $vcs 'enabled') -eq $true) -and ((& $get $vcs 'clientKind') -eq 'git') -and ((& $get $vcs 'useIgnoreFile') -eq $true)
    if (-not $vcsOk) {
      $changed.Add('biome.json')
      if (-not $Check) {
        $new = [ordered]@{ enabled = $true; clientKind = 'git'; useIgnoreFile = $true }
        if ($null -ne $vcs) {
          foreach ($p in $vcs.PSObject.Properties) { if (-not $new.Contains($p.Name)) { $new[$p.Name] = $p.Value } }
        }
        $cfg | Add-Member -NotePropertyName vcs -NotePropertyValue ([pscustomobject]$new) -Force
        [IO.File]::WriteAllText($biomeFile, ($cfg | ConvertTo-Json -Depth 20) + "`n")
        $biome = Get-Bin 'biome'
        if ($biome) {
          Push-Location -LiteralPath $Root
          try { & $biome format --write biome.json *> $null } finally { Pop-Location }
        } else {
          Add-Hint 'biome.json' 'node_modules/.bin/biome not found; run `biome format --write biome.json` after installing dependencies.'
        }
      }
    }
  }
}

# --- Vitest probe ---
if (Test-StackTool 'vitest') {
  $vitest = Get-Bin 'vitest'
  if ($vitest) {
    $wt = Join-Path $Root '.worktrees'
    $probeDir = Join-Path $wt '__probe__'
    $wtExisted = Test-Path -LiteralPath $wt
    $listing = ''
    try {
      New-Item -ItemType Directory -Path $probeDir -Force | Out-Null
      Set-Content -LiteralPath (Join-Path $probeDir 'probe.test.ts') -Value "import { it } from 'vitest'; it('probe', () => {});"
      Push-Location -LiteralPath $Root
      try { $listing = (& $vitest list 2>&1 | Out-String) } catch { $listing = '' } finally { Pop-Location }
    } finally {
      Remove-Item -LiteralPath $probeDir -Recurse -Force -ErrorAction SilentlyContinue
      if (-not $wtExisted) { Remove-Item -LiteralPath $wt -Recurse -Force -ErrorAction SilentlyContinue }
    }
    if ($listing -match '\.worktrees/') {
      Add-Hint 'vitest.config' 'Vitest lists tests under .worktrees/; add the exclude to the test options of the Vitest config.' "exclude: [...configDefaults.exclude, '**/.worktrees/**']"
    }
  }
}

# --- ESLint ---
$eslint = Get-ChildItem -LiteralPath $Root -File -Filter 'eslint.config.*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($eslint) {
  Add-Hint $eslint.Name 'ESLint 9 scans .worktrees/; add the directory to the global ignores.' "{ ignores: ['.worktrees/**'] }"
}

# apply mode: the changes are done, only hints stay open; check mode: any change is drift
$ok = ($hints.Count -eq 0) -and ($Check.IsPresent -eq $false -or $changed.Count -eq 0)
[ordered]@{ root = $Root; changed = @($changed); hints = @($hints); ok = $ok } | ConvertTo-Json -Depth 6
if ($Check -and -not $ok) { exit 1 }
exit 0
