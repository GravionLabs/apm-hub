<#
.SYNOPSIS
  Classify a diff as "mechanical" or "full" for review-fanout. Fails closed: any doubt -> full.
.PARAMETER Range
  Git range or ref passed to `git diff` (e.g. main..HEAD). Default: HEAD (working tree vs HEAD).
  Must not start with `-`; every ref must be verified by git, else full.
.PARAMETER Force
  `full` skips classification and returns full.
.PARAMETER MaxLines
  Max changed lines (added + deleted) allowed in docs, manifests and test files. Default 20.
.OUTPUTS
  JSON {"mode","dimensions","reason"}; always exit code 0 once parameters are bound.
#>
param(
  [string]$Range = 'HEAD',
  [ValidateSet('', 'full')][string]$Force = '',
  [int]$MaxLines = 20
)

$ErrorActionPreference = 'Stop'
$all = @('correctness', 'security', 'conventions', 'tests', 'spec')

function Write-Result([string]$mode, [string[]]$dims, [string]$reason) {
  [ordered]@{ mode = $mode; dimensions = @($dims); reason = $reason } | ConvertTo-Json -Compress
  exit 0
}
function Write-FullResult([string]$reason) { Write-Result 'full' $all $reason }

# Agent/skill instruction files are code-like (they steer agents), never docs.
$instruction = '(^|/)(SKILL|AGENTS|CLAUDE|GEMINI|COPILOT|copilot-instructions)\.md$|\.(agent|prompt|instructions|chatmode)\.md$|(^|/)\.(apm|github|claude|opencode|cursor)/|(^|/)skills/'
$docs = '(^|/)(README|CHANGELOG)[^/]*\.(md|mdx|txt)$|(^|/)docs/.+\.(md|mdx)$'
$manifest = '(^|/)(apm\.yml|marketplace\.json|plugin\.json)$'
$tests = '(^|/)(tests?|__tests__)/|\.(test|spec)\.[a-z]+$|(^|/)test_[^/]+$|_test\.[a-z]+$'
$sensitive = 'auth|crypt|password|secret|token|oauth|login|http|network|socket|sql|query|database|jwt|session|cookie|permission|rbac|acl|cert|tls|ssl|cors|csrf|hash|api[-_]?key|\.github/workflows|hook|dockerfile|\.env|migration|(^|/)public/'

function Get-PathKind([string]$p) {
  if ($p -imatch $instruction) { return 'other' }
  if ($p -imatch $manifest) { return 'manifest' }
  if ($p -imatch $docs) { return 'docs' }
  if ($p -imatch $tests) { return 'test' }
  return 'other'
}

function Test-Ref([string]$ref) {
  if ($ref -eq '') { return $true }
  if ($ref.StartsWith('-') -or $ref -match '\s') { return $false }
  git rev-parse --verify --quiet --end-of-options "$ref^{commit}" 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}

# Test files count as mechanical only when every changed line pair differs solely by one consistent,
# injective identifier rename (old token -> new token). Strings, comments, numbers, operators and
# keywords must stay identical. Anything unprovable returns $false.
function Test-RenameOnly([string[]]$pathspec) {
  $d = @(git -c core.quotepath=off --literal-pathspecs diff -M -U100000 --no-color $Range -- @pathspec 2>$null)
  if ($LASTEXITCODE -ne 0) { return $false }
  $rem = @(); $add = @(); $ctx = @(); $inHunk = $false
  foreach ($l in $d) {
    if ($l.StartsWith('@@')) { $inHunk = $true; continue }
    if (-not $inHunk) { continue }
    if ($l.StartsWith('-')) { $rem += $l.Substring(1) }
    elseif ($l.StartsWith('+')) { $add += $l.Substring(1) }
    elseif ($l.StartsWith('\')) { continue }
    elseif ($l.StartsWith(' ')) { $ctx += $l.Substring(1) }
    else { return $false }
  }
  if ($rem.Count -eq 0 -or $rem.Count -ne $add.Count) { return $false }
  $keep = 'true|false|null|undefined|None|True|False|not|and|or|if|else|nil|return|throw|raise|break|continue|yield|await|async|typeof|instanceof|in|is|for|while|try|catch|finally|new|delete|void|import|export|from|const|let|var|def|class|function|lambda|pass|assert|expect|it|test|describe|skip|only|todo|xit|xdescribe|fit|fdescribe'
  $tok = '"(?:\\.|[^"\\])*"|''(?:\\.|[^''\\])*''|`(?:\\.|[^`\\])*`|//.*|#.*|/\*.*|\*/|\w+|\W'
  $map = @{}
  for ($k = 0; $k -lt $rem.Count; $k++) {
    foreach ($line in @($rem[$k], $add[$k])) {
      if ($line -match '/\*|\*/|"""|''''''|^\s*\*') { return $false }
    }
    $a = @([regex]::Matches($rem[$k], $tok) | ForEach-Object { $_.Value })
    $b = @([regex]::Matches($add[$k], $tok) | ForEach-Object { $_.Value })
    if ($a.Count -ne $b.Count -or $rem[$k] -ceq $add[$k]) { return $false }
    foreach ($t in @($a) + @($b)) { if ($t -in @('"', "'", '`')) { return $false } }
    for ($t = 0; $t -lt $a.Count; $t++) {
      if ($a[$t] -ceq $b[$t]) { continue }
      if ($a[$t] -cnotmatch '^[A-Za-z_]\w*$' -or $b[$t] -cnotmatch '^[A-Za-z_]\w*$') { return $false }
      if ($a[$t] -cmatch "^($keep)$" -or $b[$t] -cmatch "^($keep)$") { return $false }
      if ($map.ContainsKey($a[$t]) -and $map[$a[$t]] -cne $b[$t]) { return $false }
      $map[$a[$t]] = $b[$t]
    }
  }
  $values = @($map.Values)
  if (@($values | Select-Object -Unique).Count -ne $values.Count) { return $false }
  foreach ($key in $map.Keys) {
    # Old name must be gone and new name must not already exist (unchanged lines included).
    if ($map.ContainsKey($map[$key]) -or ($add -cmatch "\b$([regex]::Escape($key))\b")) { return $false }
    if ($ctx -cmatch "\b$([regex]::Escape($key))\b" -or $ctx -cmatch "\b$([regex]::Escape($map[$key]))\b") { return $false }
  }
  return ($map.Count -gt 0)
}

try {
  if ($Force -eq 'full') { Write-FullResult 'forced full by caller' }

  if ($Range.StartsWith('-')) { Write-FullResult 'invalid range: starts with -' }
  $m = [regex]::Match($Range, '^(.*?)(\.\.\.?)(.*)$')
  $sides = if ($m.Success) { @($m.Groups[1].Value, $m.Groups[3].Value) } else { @($Range) }
  if (-not $m.Success -and $Range -eq '') { Write-FullResult 'invalid range: empty' }
  foreach ($side in $sides) {
    if (-not (Test-Ref $side)) { Write-FullResult "invalid range: $side" }
  }

  if (-not $m.Success) {
    # Working-tree mode: git diff cannot see untracked files.
    $untracked = @(git --literal-pathspecs ls-files --others --exclude-standard 2>$null)
    if ($LASTEXITCODE -ne 0) { Write-FullResult 'git ls-files failed' }
    if ($untracked.Count -gt 0) { Write-FullResult "untracked files present: $($untracked[0])" }
  }

  $raw = @(git -c core.quotepath=off --literal-pathspecs diff -M --raw $Range -- 2>$null)
  if ($LASTEXITCODE -ne 0) { Write-FullResult 'git diff failed' }
  $num = @(git -c core.quotepath=off --literal-pathspecs diff -M --numstat $Range -- 2>$null)
  if ($LASTEXITCODE -ne 0) { Write-FullResult 'git diff failed' }

  if ($raw.Count -eq 0) { Write-FullResult 'empty diff' }
  if ($raw.Count -ne $num.Count) { Write-FullResult 'unparseable diff' }

  $lines = 0
  $paths = @()
  for ($i = 0; $i -lt $raw.Count; $i++) {
    $parts = $raw[$i] -split "`t"
    $meta = @(($parts[0].TrimStart(':')) -split ' ')
    $n = $num[$i] -split "`t"
    if ($parts.Count -lt 2 -or $meta.Count -lt 5 -or $n.Count -lt 3) { Write-FullResult 'unparseable diff' }
    $oldMode = $meta[0]; $newMode = $meta[1]; $code = $meta[4]
    $files = @($parts[1..($parts.Count - 1)])
    $path = $files[-1]
    $paths += $files
    if ($n[0] -eq '-' -or $n[1] -eq '-') { Write-FullResult "binary file: $path" }
    if (@($oldMode, $newMode) -contains '120000' -or @($oldMode, $newMode) -contains '160000') {
      Write-FullResult "symlink or submodule: $path"
    }
    if ($oldMode -ne '000000' -and $newMode -ne '000000' -and $oldMode -ne $newMode) {
      Write-FullResult "mode change on $path"
    }
    $changed = [int]$n[0] + [int]$n[1]
    if ($code -eq 'R100') { continue }
    if ($code -notmatch '^(M|A|D|R\d+)$') { Write-FullResult "unsupported change type $code on $path" }
    $kinds = @($files | ForEach-Object { Get-PathKind $_ } | Select-Object -Unique)
    if ($kinds.Count -ne 1 -or $kinds[0] -eq 'other') {
      Write-FullResult "content change in non-docs/manifest/test file (or across kinds): $($files -join ' -> ')"
    }
    if ($kinds[0] -eq 'test') {
      if ($code -notmatch '^(M|R\d+)$' -or -not (Test-RenameOnly $files)) {
        Write-FullResult "test file change is not a pure rename of identifiers: $path"
      }
    }
    $lines += $changed
  }
  if ($lines -gt $MaxLines) { Write-FullResult "$lines changed lines exceed threshold $MaxLines" }

  $dims = @('correctness', 'spec')
  if ($paths | Where-Object { $_ -imatch $sensitive }) { $dims = @('correctness', 'security', 'spec') }
  Write-Result 'mechanical' $dims "only renames and $lines changed lines (limit $MaxLines) in docs/manifests/tests (test files: rename-only)"
} catch {
  Write-FullResult "script error: $($_.Exception.Message)"
}
