<#
.SYNOPSIS
  Report skill size and cross-skill problems as JSON (read-only).

.DESCRIPTION
  Scans every SKILL.md under -SkillsRoot (default: packages/*/.apm/skills and .github/skills)
  and reports: size per skill, skills over the line limit, dangling skill/file references
  (candidates), and lines duplicated across skills.

.PARAMETER Root
  Repository root. Defaults to the current directory.

.PARAMETER LineLimit
  SKILL.md line limit. Default 100.

.PARAMETER MinDuplicateLength
  Minimum trimmed line length counted as a duplicate. Default 60.

.OUTPUTS
  JSON to stdout; diagnostics to stderr. Non-zero exit if -Root is invalid.
#>
param(
  [string]$Root = '.',
  [int]$LineLimit = 100,
  [int]$MinDuplicateLength = 60
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Root -PathType Container)) { Write-Error "Root '$Root' is not a directory."; exit 1 }
$Root = (Resolve-Path $Root).Path

$skillFiles = @()
$skillFiles += Get-ChildItem -Path (Join-Path $Root 'packages') -Recurse -Force -Filter SKILL.md -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match '[\\/]\.apm[\\/]skills[\\/][^\\/]+[\\/]SKILL\.md$' }
$githubSkills = Join-Path $Root '.github/skills'
if (Test-Path $githubSkills) { $skillFiles += Get-ChildItem -Path $githubSkills -Recurse -Filter SKILL.md }

$names = @{}
foreach ($f in $skillFiles) { $names[$f.Directory.Name] = $true }
$families = $names.Keys | ForEach-Object { ($_ -split '-')[0] } | Sort-Object -Unique

$skills = foreach ($f in $skillFiles) {
  $dir = $f.Directory.FullName
  $lines = Get-Content $f.FullName
  $refBytes = (Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne 'SKILL.md' } | Measure-Object Length -Sum).Sum
  [pscustomobject]@{
    name = $f.Directory.Name
    path = $f.FullName.Substring($Root.Length + 1)
    lines = $lines.Count
    bytes = $f.Length
    supportBytes = [int]($refBytes ?? 0)
    overLimit = ($lines.Count -gt $LineLimit)
  }
}

$dangling = @()
$lineMap = @{}
foreach ($f in $skillFiles) {
  $dir = $f.Directory.FullName
  $text = Get-Content $f.FullName -Raw
  foreach ($m in [regex]::Matches($text, '`([a-z0-9]+(?:-[a-z0-9]+)+)`')) {
    $tok = $m.Groups[1].Value
    if (-not $names.ContainsKey($tok) -and $families -contains ($tok -split '-')[0]) {
      $dangling += [pscustomobject]@{ skill = $f.Directory.Name; kind = 'skill-name'; ref = $tok }
    }
  }
  $paths = [regex]::Matches($text, '`((?:\.\./[\w-]+/)?(?:references|assets|templates|scripts)/[\w./-]+)`|\]\(((?:references|assets)/[^)]+)\)') |
    ForEach-Object { if ($_.Groups[1].Success) { $_.Groups[1].Value } else { $_.Groups[2].Value } } | Sort-Object -Unique
  foreach ($p in $paths) {
    if ($p -match '[<{*]') { continue }
    if (-not (Test-Path (Join-Path $dir $p))) {
      $dangling += [pscustomobject]@{ skill = $f.Directory.Name; kind = 'file'; ref = $p }
    }
  }
  foreach ($file in Get-ChildItem $dir -Recurse -File -Include *.md) {
    foreach ($l in Get-Content $file.FullName) {
      $t = $l.Trim()
      if ($t.Length -lt $MinDuplicateLength -or $t -match '^(\||```|---|#)') { continue }
      if (-not $lineMap.ContainsKey($t)) { $lineMap[$t] = [System.Collections.Generic.HashSet[string]]::new() }
      [void]$lineMap[$t].Add($f.Directory.Name)
    }
  }
}

$duplicates = $lineMap.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 } |
  Sort-Object { $_.Value.Count } -Descending | Select-Object -First 25 |
  ForEach-Object { [pscustomobject]@{ skills = @($_.Value | Sort-Object); line = $_.Key } }

[Console]::Error.WriteLine("scanned $($skillFiles.Count) skills")
[pscustomobject]@{
  limit = $LineLimit
  totalSkills = $skills.Count
  totalSkillBytes = ($skills | Measure-Object bytes -Sum).Sum
  totalSupportBytes = ($skills | Measure-Object supportBytes -Sum).Sum
  largest = @($skills | Sort-Object lines -Descending | Select-Object -First 10)
  overLimit = @($skills | Where-Object overLimit | Select-Object name, lines)
  danglingCandidates = @($dangling | Sort-Object skill, ref -Unique)
  duplicatedLines = @($duplicates)
} | ConvertTo-Json -Depth 6
