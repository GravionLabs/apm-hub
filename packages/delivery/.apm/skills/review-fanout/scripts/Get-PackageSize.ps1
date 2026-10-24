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
$remOld = 0; $remNew = 0   # lines still owed by the current hunk header
$sizes = [ordered]@{}
foreach ($line in [System.IO.File]::ReadLines((Resolve-Path -LiteralPath $Path))) {
  $inHunk = ($remOld -gt 0 -or $remNew -gt 0)
  if ($inHunk) {
    # body of a real hunk: consume exactly the lines the header announced
    if ($line.StartsWith(' ')) { $remOld--; $remNew-- }
    elseif ($line.StartsWith('-')) { $remOld-- }
    elseif ($line.StartsWith('+')) { $remNew-- }
    elseif (-not $line.StartsWith('\')) { $remOld = 0; $remNew = 0; $inHunk = $false }
    if ($inHunk) { $sizes[$file] += [System.Text.Encoding]::UTF8.GetByteCount($line) + 1; continue }
  }
  if ($line -ceq $marker) { $inDocs = $true; $file = $null; continue }
  if ($line -match '^diff --git a/.+ b/(.+)$') {
    $file = $Matches[1]; if (-not $sizes.Contains($file)) { $sizes[$file] = 0 }
  }
  elseif ($file -and $line -match '^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@') {
    $remOld = if ($Matches[1] -ne $null -and $Matches[1] -ne '') { [int]$Matches[1] } else { 1 }
    $remNew = if ($Matches[2] -ne $null -and $Matches[2] -ne '') { [int]$Matches[2] } else { 1 }
    if ($inDocs) { $docsHunks++ } else { $hunks++ }
  }
  elseif ($file -and $line -notmatch '^(index |--- |\+\+\+ |old mode|new mode|deleted file|new file|similarity|rename |copy |Binary files|\\)') {
    $file = $null   # appended text (issue, findings): stop attributing bytes to the last file
  }
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
