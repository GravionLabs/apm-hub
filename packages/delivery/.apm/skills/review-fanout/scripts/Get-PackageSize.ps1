<#
.SYNOPSIS
  Size of a review package file: bytes, estimated tokens, hunks, docsHunks, oversize note.
.PARAMETER Path
  Package file written by review-fanout step 1.
.PARAMETER Threshold
  Estimated-token limit for the oversize note (default 15000).
#>
param(
  [Parameter(Mandatory)][string]$Path,
  [int]$Threshold = 15000
)
$ErrorActionPreference = 'Stop'
$marker = '=== DOCUMENTATION ==='
$bytes = (Get-Item -LiteralPath $Path).Length
$tokens = [int][math]::Ceiling($bytes / 4)
$hunks = 0; $docsHunks = 0; $inDocs = $false; $file = $null
$sizes = [ordered]@{}
foreach ($line in [System.IO.File]::ReadLines((Resolve-Path -LiteralPath $Path))) {
  if ($line -ceq $marker) { $inDocs = $true; $file = $null; continue }
  if ($line -match '^diff --git a/.+ b/(.+)$') { $file = $Matches[1]; if (-not $sizes.Contains($file)) { $sizes[$file] = 0 } }
  if ($line -match '^@@') { if ($inDocs) { $docsHunks++ } else { $hunks++ } }
  if ($file) { $sizes[$file] += [System.Text.Encoding]::UTF8.GetByteCount($line) + 1 }
}
$pkg = [ordered]@{ bytes = $bytes; tokensEstimated = $tokens; hunks = $hunks; docsHunks = $docsHunks }
if ($tokens -gt $Threshold) {
  $largest = @($sizes.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 3 |
    ForEach-Object { [ordered]@{ file = $_.Key; bytes = $_.Value } })
  $pkg.oversize = [ordered]@{ threshold = $Threshold; largest = $largest }
  $pkg.summary = 'package ~{0}k tokens > {1}k — largest: {2}' -f [math]::Round($tokens / 1000), [math]::Floor($Threshold / 1000), (($largest | ForEach-Object { $_.file }) -join ', ')
}
$pkg | ConvertTo-Json -Depth 5 -Compress
