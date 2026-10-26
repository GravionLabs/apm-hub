#!/usr/bin/env pwsh
# Fake Set-ParkedGate.ps1 for the queue tests (PARK_SCRIPT, default in queue.helpers.ts): never reaches gh.
# Appends '<issue>|<question>' to park.log in the working directory, exits with FAKE_PARK_EXIT when set and
# prints FAKE_PARK_OUT (default: an all-ok result JSON) as the last line.
param([string]$Issue, [string]$Question)
Add-Content -LiteralPath (Join-Path (Get-Location).Path 'park.log') -Value "$Issue|$Question" -Encoding utf8
if ($env:FAKE_PARK_EXIT) { exit [int]$env:FAKE_PARK_EXIT }
if ($env:FAKE_PARK_OUT) { $env:FAKE_PARK_OUT } else { '{"parked":true,"label":"ok","comment":"ok","ledger":"skipped","checkout":"x"}' }
