# Test wrapper: runs Invoke-OrchestratorQueue.ps1 once per case inside ONE pwsh process (cold start ~1 s each).
# Usage: pwsh -NoProfile -File queue-batch.ps1 <script> <cases.json> <results.json>
# case: { args: string[], cwd: string, path?: string }; result: { status, stdout, stderr } per case, in order.
param([string]$Script, [string]$Spec, [string]$Out)
$cases = @(Get-Content -Raw -LiteralPath $Spec | ConvertFrom-Json)
$results = foreach ($c in $cases) {
  Set-Location -LiteralPath $c.cwd
  $oldPath = $env:PATH
  if ($c.path) { $env:PATH = $c.path }
  # '-Name' tokens stay parameters, everything else is a quoted positional/value argument
  $line = (@($c.args) | ForEach-Object { if ($_ -cmatch '^-[A-Za-z]+$') { $_ } else { "'" + ($_ -replace "'", "''") + "'" } }) -join ' '
  $global:LASTEXITCODE = $null
  $stdout = [System.Collections.Generic.List[string]]::new()
  $stderr = [System.Collections.Generic.List[string]]::new()
  $code = 0
  try {
    $items = & { Invoke-Expression "& `$Script $line" } *>&1
    if ($null -ne $LASTEXITCODE) { $code = $LASTEXITCODE }
    foreach ($i in $items) { if ($i -is [System.Management.Automation.ErrorRecord] -or $i -is [System.Management.Automation.WarningRecord]) { $stderr.Add("$i") } else { $stdout.Add("$i") } }
  } catch { $code = 1; $stderr.Add($_.Exception.Message) }
  $env:PATH = $oldPath
  [pscustomobject]@{ status = $code; stdout = (($stdout | ForEach-Object { "$_`n" }) -join ''); stderr = (($stderr | ForEach-Object { "$_`n" }) -join '') }
}
ConvertTo-Json -InputObject @($results) -Depth 3 | Set-Content -LiteralPath $Out -Encoding utf8
