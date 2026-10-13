<#
.SYNOPSIS
  Classify a diff as "mechanical" or "full" for review-fanout. Fails closed: any doubt -> full.
.PARAMETER Range
  Git range or ref passed to `git diff` (e.g. main..HEAD). Default: HEAD (working tree vs HEAD).
.PARAMETER Force
  `full` skips classification and returns full.
.PARAMETER MaxLines
  Max changed lines (added + deleted) allowed in docs, manifests and test files. Default 20.
.OUTPUTS
  JSON {"mode","dimensions","reason"}
#>
param(
  [string]$Range = 'HEAD',
  [ValidateSet('', 'full')][string]$Force = '',
  [int]$MaxLines = 20
)

$all = @('correctness', 'security', 'conventions', 'tests', 'spec')
function Out([string]$mode, [string[]]$dims, [string]$reason) {
  [ordered]@{ mode = $mode; dimensions = @($dims); reason = $reason } | ConvertTo-Json -Compress
  exit 0
}
function Full([string]$reason) { Out 'full' $all $reason }

if ($Force -eq 'full') { Full 'forced full by caller' }

$ErrorActionPreference = 'Stop'
try {
  $status = @(git -c core.quotepath=off diff -M --name-status $Range 2>$null)
  if ($LASTEXITCODE -ne 0) { Full 'git diff failed' }
  $num = @(git -c core.quotepath=off diff -M --numstat $Range 2>$null)
  if ($LASTEXITCODE -ne 0) { Full 'git diff failed' }
} catch { Full 'git diff failed' }

if ($status.Count -eq 0) { Full 'empty diff' }
if ($status.Count -ne $num.Count) { Full 'unparseable diff' }

$docs = '(^|/)docs/|\.(md|mdx|txt)$'
$manifest = '(^|/)(apm\.yml|marketplace\.json|plugin\.json|package\.json)$'
$tests = '(^|/)(tests?|__tests__)/|\.(test|spec)\.[a-z]+$|(^|/)test_[^/]+$|_test\.[a-z]+$'
$sensitive = 'auth|crypto|password|secret|token|oauth|login|http|network|socket|\.sql$|sql|query|database'

$lines = 0
$paths = @()
for ($i = 0; $i -lt $status.Count; $i++) {
  $s = $status[$i] -split "`t"
  $n = $num[$i] -split "`t"
  if ($s.Count -lt 2 -or $n.Count -lt 3) { Full 'unparseable diff' }
  $code = $s[0]
  $path = $s[-1]
  $paths += $s[1..($s.Count - 1)]
  if ($n[0] -eq '-' -or $n[1] -eq '-') { Full "binary file: $path" }
  $changed = [int]$n[0] + [int]$n[1]
  if ($code -eq 'R100') { continue }
  if ($code -notmatch '^(M|A|D|R\d+)$') { Full "unsupported change type $code on $path" }
  if ($path -notmatch $docs -and $path -notmatch $manifest -and $path -notmatch $tests) {
    Full "content change in non-docs/manifest/test file: $path"
  }
  $lines += $changed
}
if ($lines -gt $MaxLines) { Full "$lines changed lines exceed threshold $MaxLines" }

$dims = @('correctness', 'spec')
if ($paths | Where-Object { $_ -imatch $sensitive }) { $dims = @('correctness', 'security', 'spec') }
Out 'mechanical' $dims "only renames and $lines changed lines (limit $MaxLines) in docs/manifests/tests"
