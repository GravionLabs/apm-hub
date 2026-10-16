#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Installs (or removes) the apm-hub status line and subagent status line for Claude Code.
.DESCRIPTION
  Copies statusline.mjs and subagent-statusline.mjs to ~/.claude/apm-hub/statusline/ and sets 'statusLine' and
  'subagentStatusLine' in ~/.claude/settings.json to: node ~/.claude/apm-hub/statusline/<file>.mjs (type 'command').
  Every other key is kept (key order and values). A backup settings.json.bak-<timestamp> is written before any change.
  Idempotent: an up-to-date install changes nothing. A 'statusLine' or 'subagentStatusLine' that does not point at
  apm-hub/statusline/ is foreign and only replaced with -Force. -Uninstall removes only our entries and our two files.
  Supports -WhatIf and -Confirm. Needs Node >= 22 at run time (not for this installer).
.PARAMETER Force      Replace foreign statusLine / subagentStatusLine entries.
.PARAMETER Uninstall  Remove our entries and copied scripts.
#>
[CmdletBinding(SupportsShouldProcess)]
param([switch]$Force, [switch]$Uninstall)
$ErrorActionPreference = 'Stop'

$files = @('statusline.mjs', 'subagent-statusline.mjs')
$keys = [ordered]@{ statusLine = 'statusline.mjs'; subagentStatusLine = 'subagent-statusline.mjs' }
$claude = Join-Path $HOME '.claude'
$settings = Join-Path $claude 'settings.json'
$destDir = Join-Path $claude 'apm-hub/statusline'
$cmdFor = { param($f) "node ~/.claude/apm-hub/statusline/$f" }
$isOurs = { param($node)
  try { $cmd = $node['command'].GetValue[string](); $cmd -match 'apm-hub/statusline/(statusline|subagent-statusline)\.mjs\s*$' } catch { $false } }

$jsonNode = [System.Text.Json.Nodes.JsonNode]
$docOpts = [System.Text.Json.JsonDocumentOptions]::new()
$docOpts.CommentHandling = [System.Text.Json.JsonCommentHandling]::Skip
$docOpts.AllowTrailingCommas = $true
$root = $null
if (Test-Path -LiteralPath $settings) {
  $text = [IO.File]::ReadAllText($settings)
  if ($text.Trim()) {
    try { $root = $jsonNode::Parse($text, $null, $docOpts) } catch { throw "$settings is not valid JSON: $($_.Exception.Message)" }
    if ($root -isnot [System.Text.Json.Nodes.JsonObject]) { throw "$settings is not a JSON object." }
  }
}
if (-not $root) { $root = [System.Text.Json.Nodes.JsonObject]::new() }
$before = $root.ToJsonString()

# Decide changes
$foreign = @()
foreach ($k in $keys.Keys) {
  $cur = $root[$k]
  if ($null -eq $cur) { continue }
  if (-not (& $isOurs $cur)) { $foreign += $k }
}
if ($Uninstall) {
  foreach ($k in $keys.Keys) { if ($null -ne $root[$k] -and (& $isOurs $root[$k])) { [void]$root.Remove($k) } }
  foreach ($k in $foreign) { Write-Warning "$k is not an apm-hub entry; left untouched." }
} else {
  if ($foreign -and -not $Force) { throw "Existing $($foreign -join ', ') not managed by apm-hub in $settings. Use -Force to replace." }
  foreach ($k in $keys.Keys) {
    $o = [System.Text.Json.Nodes.JsonObject]::new()
    $o['type'] = 'command'
    $o['command'] = & $cmdFor $keys[$k]
    $root[$k] = $o
  }
}
$settingsChanged = $root.ToJsonString() -cne $before

# Scripts
$srcDir = $PSScriptRoot
$copy = @()
if (-not $Uninstall) {
  foreach ($f in $files) {
    $dst = Join-Path $destDir $f
    if (-not (Test-Path -LiteralPath $dst) -or ([IO.File]::ReadAllText($dst) -cne [IO.File]::ReadAllText((Join-Path $srcDir $f)))) { $copy += $f }
  }
}

if ($settingsChanged) {
  $so = [System.Text.Json.JsonSerializerOptions]::new()
  $so.WriteIndented = $true
  $so.Encoder = [System.Text.Encodings.Web.JavaScriptEncoder]::UnsafeRelaxedJsonEscaping
  $out = $root.ToJsonString($so) + "`n"
  if ($PSCmdlet.ShouldProcess($settings, 'Update statusLine / subagentStatusLine')) {
    New-Item -ItemType Directory -Path $claude -Force | Out-Null
    if (Test-Path -LiteralPath $settings) {
      $bak = "$settings.bak-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff'))"
      Copy-Item -LiteralPath $settings -Destination $bak
      Write-Host "Backup $bak"
    }
    [IO.File]::WriteAllText($settings, $out, [Text.UTF8Encoding]::new($false))
    Write-Host "$(if ($Uninstall) { 'Removed entries from' } else { 'Updated' }) $settings"
  }
}

if ($Uninstall) {
  foreach ($f in $files) {
    $dst = Join-Path $destDir $f
    if ((Test-Path -LiteralPath $dst) -and $PSCmdlet.ShouldProcess($dst, 'Remove script')) { Remove-Item -LiteralPath $dst; Write-Host "Removed $dst" }
  }
  if ((Test-Path -LiteralPath $destDir) -and -not (Get-ChildItem -LiteralPath $destDir -Force) -and $PSCmdlet.ShouldProcess($destDir, 'Remove empty directory')) {
    Remove-Item -LiteralPath $destDir
  }
} else {
  foreach ($f in $copy) {
    $dst = Join-Path $destDir $f
    if ($PSCmdlet.ShouldProcess($dst, 'Copy script')) {
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
      Copy-Item -LiteralPath (Join-Path $srcDir $f) -Destination $dst -Force
      Write-Host "Installed $dst"
    }
  }
}
if (-not $settingsChanged -and -not $copy) { Write-Host 'Up to date: nothing to do.' }
