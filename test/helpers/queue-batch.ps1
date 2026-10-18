# Test wrapper: runs Invoke-OrchestratorQueue.ps1 once per case inside ONE pwsh process (cold start ~1 s each).
# Usage: pwsh -NoProfile -File queue-batch.ps1 <script> <cases.json> <results.json>
# case: { key: string, args: string[], cwd: string, path?: string }; result: { status, stdout, stderr } per case, in order.
param([string]$Script, [string]$Spec, [string]$Out)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$cases = @(Get-Content -Raw -LiteralPath $Spec | ConvertFrom-Json)
$params = (Get-Command $Script).Parameters
$baseEnv = @{ PATH = $env:PATH; Cwd = (Get-Location).Path }
$results = foreach ($c in $cases) {
  # clean slate per case: the runner reads QUEUE_*, OPENCODE_PERMISSION and PATH
  Get-ChildItem Env: | Where-Object { $_.Name -like 'QUEUE_*' -or $_.Name -eq 'OPENCODE_PERMISSION' } | ForEach-Object { Remove-Item "Env:$($_.Name)" }
  $env:QUEUE_POLL_SECONDS = '0'
  $env:PATH = if ($c.PSObject.Properties['path'] -and $c.path) { $c.path } else { $baseEnv.PATH }
  Set-Location -LiteralPath $c.cwd
  # '-Name' tokens become named parameters (switches take no value), everything else is a positional argument
  $named = @{}; $positional = [System.Collections.Generic.List[string]]::new()
  $tokens = @($c.args)
  for ($i = 0; $i -lt $tokens.Count; $i++) {
    $t = [string]$tokens[$i]
    if ($t -cmatch '^-([A-Za-z]+)$') {
      $name = $Matches[1]
      if (-not $params.ContainsKey($name)) { throw "case '$($c.key)': unknown parameter -$name" }
      if ($params[$name].SwitchParameter) { $named[$name] = $true } else { $i++; $named[$name] = [string]$tokens[$i] }
    } else { $positional.Add($t) }
  }
  $global:LASTEXITCODE = $null
  $stdout = [System.Collections.Generic.List[string]]::new()
  $stderr = [System.Collections.Generic.List[string]]::new()
  $code = 0
  try {
    $items = & { Set-StrictMode -Off; $ErrorActionPreference = 'Continue'; & $Script @named @positional } *>&1
    if ($null -ne $global:LASTEXITCODE) { $code = $global:LASTEXITCODE }
    foreach ($i in $items) { if ($i -is [System.Management.Automation.ErrorRecord] -or $i -is [System.Management.Automation.WarningRecord]) { $stderr.Add("$i") } else { $stdout.Add("$i") } }
  } catch { $code = 1; $stderr.Add($_.Exception.Message) }
  [pscustomobject]@{ status = $code; stdout = (($stdout | ForEach-Object { "$_`n" }) -join ''); stderr = (($stderr | ForEach-Object { "$_`n" }) -join '') }
}
Set-Location -LiteralPath $baseEnv.Cwd
ConvertTo-Json -InputObject @($results) -Depth 3 | Set-Content -LiteralPath $Out -Encoding utf8
