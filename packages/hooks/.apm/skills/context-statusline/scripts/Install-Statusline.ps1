#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Installs (or removes) the apm-hub status line for Claude Code and/or GitHub Copilot CLI.
.DESCRIPTION
  -Client claude (default): copies statusline.mjs and subagent-statusline.mjs to ~/.claude/apm-hub/statusline/ and sets
  'statusLine' and 'subagentStatusLine' in ~/.claude/settings.json to: node ~/.claude/apm-hub/statusline/<file>.mjs.
  -Client copilot: copies statusline.mjs to <copilot home>/apm-hub/statusline/ and sets 'statusLine' (with padding 1) in
  <copilot home>/settings.json plus the feature flag STATUS_LINE in feature_flags.enabled (added once, other flags kept).
  <copilot home> is $COPILOT_HOME when set (then the command carries the absolute path), else ~/.copilot. Copilot CLI has
  no subagent status line. -Client all does both.
  Every other key is kept (order and values). A backup settings.json.bak-<timestamp> is written before any change.
  Idempotent. An entry that does not point at apm-hub/statusline/ is foreign and only replaced with -Force.
  -Uninstall removes only our entries and our two files per client; the STATUS_LINE flag is left in place (it may be
  wanted by another status line). Supports -WhatIf and -Confirm.
.PARAMETER Client     claude (default), copilot or all.
.PARAMETER Force      Replace foreign statusLine / subagentStatusLine entries.
.PARAMETER Uninstall  Remove our entries and copied scripts.
#>
[CmdletBinding(SupportsShouldProcess)]
param([ValidateSet('claude', 'copilot', 'all')][string]$Client = 'claude', [switch]$Force, [switch]$Uninstall)
$ErrorActionPreference = 'Stop'

function Get-Cfg([string]$name) {
  if ($name -eq 'claude') {
    @{ Name = 'claude'; Dir = (Join-Path $HOME '.claude'); Base = '~/.claude/apm-hub/statusline'; Padding = $false
       Keys = [ordered]@{ statusLine = 'statusline.mjs'; subagentStatusLine = 'subagent-statusline.mjs' } }
  } else {
    $dir = if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $HOME '.copilot' }
    $base = if ($env:COPILOT_HOME) { ($dir -replace '\\', '/').TrimEnd('/') + '/apm-hub/statusline' } else { '~/.copilot/apm-hub/statusline' }
    @{ Name = 'copilot'; Dir = $dir; Base = $base; Padding = $true; Keys = [ordered]@{ statusLine = 'statusline.mjs' } }
  }
}

function Install-Client($cfg) {
$keys = $cfg.Keys
$files = @($keys.Values)
$claude = $cfg.Dir
$settings = Join-Path $claude 'settings.json'
$destDir = Join-Path $claude 'apm-hub/statusline'
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
  if ($foreign -and -not $Force) { throw "[$($cfg.Name)] Existing $($foreign -join ', ') not managed by apm-hub in $settings. Use -Force to replace." }
  foreach ($k in $keys.Keys) {
    $o = [System.Text.Json.Nodes.JsonObject]::new()
    $o['type'] = 'command'
    $o['command'] = "node $($cfg.Base)/$($keys[$k])"
    if ($cfg.Padding) { $o['padding'] = 1 }
    $root[$k] = $o
  }
}
if (-not $Uninstall -and $cfg.Name -eq 'copilot') {
  $ff = $root['feature_flags']
  if ($null -eq $ff) { $ff = [System.Text.Json.Nodes.JsonObject]::new(); $root['feature_flags'] = $ff }
  if ($ff -isnot [System.Text.Json.Nodes.JsonObject]) { throw "feature_flags in $settings is not an object." }
  $en = $ff['enabled']
  if ($null -eq $en) { $en = [System.Text.Json.Nodes.JsonArray]::new(); $ff['enabled'] = $en }
  if ($en -isnot [System.Text.Json.Nodes.JsonArray]) { throw "feature_flags.enabled in $settings is not an array." }
  if (-not ($en | Where-Object { $_ -is [System.Text.Json.Nodes.JsonValue] -and $_.ToJsonString() -ceq '"STATUS_LINE"' })) { $en.Add('STATUS_LINE') }
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
if (-not $settingsChanged -and -not $copy) { Write-Host "Up to date ($($cfg.Name)): nothing to do." }
}

foreach ($n in $(if ($Client -eq 'all') { 'claude', 'copilot' } else { $Client })) { Install-Client (Get-Cfg $n) }
