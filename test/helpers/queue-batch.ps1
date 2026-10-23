# Test wrapper: runs Invoke-OrchestratorQueue.ps1 once per case inside ONE pwsh process (cold start ~1 s each).
# Usage: pwsh -NoProfile -File queue-batch.ps1 <script> <cases.json> <results.json>
# case: { key: string, args: string[], cwd: string, path?: string, env?: { NAME: string | null } }; result: { status, stdout, stderr } per case, in order.
param([string]$Script, [string]$Spec, [string]$Out)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$cases = @(Get-Content -Raw -LiteralPath $Spec | ConvertFrom-Json)
$params = (Get-Command $Script).Parameters
$baseEnv = @{ PATH = $env:PATH; Cwd = (Get-Location).Path }
. (Join-Path $PSScriptRoot 'invoke-case.ps1')
$results = foreach ($c in $cases) { Invoke-ScriptCase -Script $Script -Params $params -BasePath $baseEnv.PATH -Case $c }
Set-Location -LiteralPath $baseEnv.Cwd
ConvertTo-Json -InputObject @($results) -Depth 3 | Set-Content -LiteralPath $Out -Encoding utf8
