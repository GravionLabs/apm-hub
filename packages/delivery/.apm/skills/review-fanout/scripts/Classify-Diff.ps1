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

function Exit-WithResult([string]$mode, [string[]]$dims, [string]$reason) {
  [ordered]@{ mode = $mode; dimensions = @($dims); reason = $reason } | ConvertTo-Json -Compress
  exit 0
}
function Exit-WithFull([string]$reason) { Exit-WithResult 'full' $all $reason }

# Agent/skill instruction files are code-like (they steer agents), never docs.
$instruction = '(^|/)(SKILL|AGENTS|CLAUDE|GEMINI|COPILOT|copilot-instructions)\.md$|\.(agent|prompt|instructions|chatmode)\.md$|(^|/)\.(apm|github|claude|opencode|cursor|husky|vscode)/|(^|/)(skills|hooks)/|(^|/)(\.mcp\.json|\.npmrc|\.yarnrc(\.yml)?|\.pre-commit-config\.yaml|setup\.py|conftest\.py|GNUmakefile|[Mm]akefile)$|(^|/)Dockerfile[^/]*$'
$docs = '(^|/)(README|CHANGELOG)[^/]*\.(md|mdx|txt)$|(^|/)docs/.+\.(md|mdx)$'
$manifest = '(^|/)(apm\.yml|marketplace\.json|plugin\.json)$'
# Added lines that look like commands or remote fetches add the security dimension.
$risky = '\b(curl|wget|eval|iex|chmod|sudo|Invoke-Expression)\b|https?://|\|\s*(sh|bash|zsh|pwsh|powershell)\b'
$tests = '(^|/)(tests?|__tests__)/|\.(test|spec)\.[a-z]+$|(^|/)test_[^/]+$|_test\.[a-z]+$'
$sensitive = 'auth|crypt|password|secret|token|oauth|login|http|network|socket|sql|query|database|jwt|session|cookie|permission|rbac|acl|cert|tls|ssl|cors|csrf|hash|api[-_]?key|\.github/workflows|hook|dockerfile|husky|\.mcp|makefile|\.npmrc|\.vscode|setup\.py|conftest|\.env|migration|(^|/)public/'

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
    $new = [regex]::Escape($map[$key])
    # The new name must not exist anywhere in the removed lines (merges identifiers, tautologies).
    if ($map.ContainsKey($map[$key]) -or ($add -cmatch "\b$([regex]::Escape($key))\b") -or ($rem -cmatch "\b$new\b")) { return $false }
    if ($ctx -cmatch "\b$([regex]::Escape($key))\b" -or $ctx -cmatch "\b$([regex]::Escape($map[$key]))\b") { return $false }
  }
  return ($map.Count -gt 0)
}

try {
  if ($Force -eq 'full') { Exit-WithFull 'forced full by caller' }

  if ($Range.StartsWith('-')) { Exit-WithFull 'invalid range: starts with -' }
  $m = [regex]::Match($Range, '^(.*?)(\.\.\.?)(.*)$')
  $sides = if ($m.Success) { @($m.Groups[1].Value, $m.Groups[3].Value) } else { @($Range) }
  if (-not $m.Success -and $Range -eq '') { Exit-WithFull 'invalid range: empty' }
  foreach ($side in $sides) {
    if (-not (Test-Ref $side)) { Exit-WithFull "invalid range: $side" }
  }

  if (-not $m.Success) {
    # Working-tree mode: git diff cannot see untracked files.
    $untracked = @(git --literal-pathspecs ls-files --others --exclude-standard 2>$null)
    if ($LASTEXITCODE -ne 0) { Exit-WithFull 'git ls-files failed' }
    if ($untracked.Count -gt 0) { Exit-WithFull "untracked files present: $($untracked[0])" }
  }

  $out = @(git -c core.quotepath=off --literal-pathspecs diff -M --raw --numstat $Range -- 2>$null)
  if ($LASTEXITCODE -ne 0) { Exit-WithFull 'git diff failed' }
  $raw = @($out | Where-Object { $_.StartsWith(':') })
  $num = @($out | Where-Object { -not $_.StartsWith(':') })

  if ($raw.Count -eq 0) { Exit-WithFull 'empty diff' }
  if ($raw.Count -ne $num.Count) { Exit-WithFull 'unparseable diff' }

  $lines = 0
  $risk = $false
  $paths = @()
  for ($i = 0; $i -lt $raw.Count; $i++) {
    $parts = $raw[$i] -split "`t"
    $meta = @(($parts[0].TrimStart(':')) -split ' ')
    $n = $num[$i] -split "`t"
    if ($parts.Count -lt 2 -or $meta.Count -lt 5 -or $n.Count -lt 3) { Exit-WithFull 'unparseable diff' }
    $oldMode = $meta[0]; $newMode = $meta[1]; $code = $meta[4]
    $files = @($parts[1..($parts.Count - 1)])
    $path = $files[-1]
    $paths += $files
    if ($n[0] -eq '-' -or $n[1] -eq '-') { Exit-WithFull "binary file: $path" }
    if (@($oldMode, $newMode) -contains '120000' -or @($oldMode, $newMode) -contains '160000') {
      Exit-WithFull "symlink or submodule: $path"
    }
    if ($oldMode -ne '000000' -and $newMode -ne '000000' -and $oldMode -ne $newMode) {
      Exit-WithFull "mode change on $path"
    }
    $changed = [int]$n[0] + [int]$n[1]
    if (@($files | Where-Object { $_ -imatch $instruction }).Count -gt 0) {
      Exit-WithFull "instruction or auto-executed path touched: $($files -join ' -> ')"
    }
    if ($oldMode -eq '000000' -and $newMode -ne '100644') { Exit-WithFull "added file with mode ${newMode}: $path" }
    if ($code -eq 'R100') { continue }
    if ($code -notmatch '^(M|A|D|R\d+)$') { Exit-WithFull "unsupported change type $code on $path" }
    $kinds = @($files | ForEach-Object { Get-PathKind $_ } | Select-Object -Unique)
    if ($kinds.Count -ne 1 -or $kinds[0] -eq 'other') {
      Exit-WithFull "content change in non-docs/manifest/test file (or across kinds): $($files -join ' -> ')"
    }
    if ($kinds[0] -eq 'test') {
      if ($code -notmatch '^(M|R\d+)$' -or -not (Test-RenameOnly $files)) {
        Exit-WithFull "test file change is not a pure rename of identifiers: $path"
      }
    }
    $lines += $changed
    $added = @(git -c core.quotepath=off --literal-pathspecs diff -M -U0 --no-color $Range -- @files 2>$null)
    if ($LASTEXITCODE -ne 0) { Exit-WithFull "git diff failed for $path" }
    if (@($added | Where-Object { $_.StartsWith('+') -and -not $_.StartsWith('+++') -and $_ -imatch $risky }).Count -gt 0) {
      $risk = $true
    }
  }
  if ($lines -gt $MaxLines) { Exit-WithFull "$lines changed lines exceed threshold $MaxLines" }

  $dims = @('correctness', 'spec')
  if ($risk -or ($paths | Where-Object { $_ -imatch $sensitive -or $_ -imatch $manifest })) { $dims = @('correctness', 'security', 'spec') }
  Exit-WithResult 'mechanical' $dims "only renames and $lines changed lines (limit $MaxLines) in docs/manifests/tests (test files: rename-only)"
} catch {
  Exit-WithFull "script error: $($_.Exception.Message)"
}
