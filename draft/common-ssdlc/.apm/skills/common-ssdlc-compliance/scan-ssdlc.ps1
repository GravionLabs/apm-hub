<#
.SYNOPSIS
    RWEST SSDLC automated pattern scanner for .NET code changes.
    Checks changed files for common SSDLC policy violations.
    Called by the ssdlc-compliance skill.
#>

param(
    [string[]]$Files
)

$findings = [System.Collections.Generic.List[PSCustomObject]]::new()

function Add-Finding {
    param($Rule, $Severity, $File, $Line, $Content, $Message)
    $findings.Add([PSCustomObject]@{
        Rule     = $Rule
        Severity = $Severity
        File     = $File
        Line     = $Line
        Content  = $Content.Trim()
        Message  = $Message
    })
}

# ── Patterns ──────────────────────────────────────────────────────────────────

$secretPatterns = @(
    # Connection strings with credentials
    @{ Pattern = '(?i)(password|pwd|passwd)\s*=\s*[^;\s\$\{][^;\s]{3,}'; Rule = 'SSDLC-01'; Msg = 'Possible hardcoded password in connection string or config' }
    @{ Pattern = '(?i)(AccountKey|SharedAccessKey|accesskey)\s*=\s*[A-Za-z0-9+/]{20,}'; Rule = 'SSDLC-01'; Msg = 'Possible hardcoded storage/access key' }
    @{ Pattern = '(?i)(api[_-]?key|apikey|secret[_-]?key|client[_-]?secret)\s*=\s*["''][A-Za-z0-9\-_\.]{8,}["'']'; Rule = 'SSDLC-01'; Msg = 'Possible hardcoded API key or client secret' }
    @{ Pattern = '-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'; Rule = 'SSDLC-01'; Msg = 'Private key material embedded in source' }
    @{ Pattern = '(?i)(AKIA|ASIA)[A-Z0-9]{16}'; Rule = 'SSDLC-01'; Msg = 'AWS Access Key ID pattern detected' }
    @{ Pattern = '(?i)Bearer\s+[A-Za-z0-9\-_\.]{20,}'; Rule = 'SSDLC-01'; Msg = 'Hardcoded Bearer token' }
)

$forbiddenAlgorithms = @(
    @{ Pattern = '(?i)(MD5\.Create|new\s+MD5CryptoServiceProvider|MD5\.HashData)'; Rule = 'SSDLC-04'; Msg = 'FORBIDDEN: MD5 is prohibited. Use SHA-256 or higher.' }
    @{ Pattern = '(?i)(SHA1\.Create|new\s+SHA1Managed|new\s+SHA1CryptoServiceProvider|SHA1\.HashData)'; Rule = 'SSDLC-04'; Msg = 'FORBIDDEN: SHA1 is prohibited. Use SHA-256 or higher.' }
    @{ Pattern = '(?i)(DES\.Create|new\s+DESCryptoServiceProvider)\b'; Rule = 'SSDLC-04'; Msg = 'FORBIDDEN: DES is prohibited. Use AES-256.' }
    @{ Pattern = '(?i)(TripleDES\.Create|new\s+TripleDESCryptoServiceProvider)\b'; Rule = 'SSDLC-04'; Msg = 'FORBIDDEN: 3DES is prohibited. Use AES-256.' }
    @{ Pattern = '(?i)new\s+RijndaelManaged'; Rule = 'SSDLC-04'; Msg = 'FORBIDDEN: RijndaelManaged is deprecated. Use Aes.Create() with KeySize=256.' }
    @{ Pattern = '(?i)MD5\s*\('; Rule = 'SSDLC-04'; Msg = 'Possible MD5 usage (verify). MD5 is prohibited.' }
)

$deprecatedTls = @(
    @{ Pattern = '(?i)SslProtocols\.(Ssl2|Ssl3|Tls\b|Tls11)'; Rule = 'SSDLC-05'; Msg = 'FORBIDDEN: Deprecated SSL/TLS version. Use Tls12 | Tls13 only.' }
    @{ Pattern = '(?i)SecurityProtocolType\.(Ssl3|Tls\b|Tls11)'; Rule = 'SSDLC-05'; Msg = 'FORBIDDEN: Deprecated SecurityProtocol. Use Tls12 | Tls13.' }
    @{ Pattern = '(?i)ServicePointManager\.SecurityProtocol\s*=\s*(?!.*Tls12)(?!.*Tls13)'; Rule = 'SSDLC-05'; Msg = 'ServicePointManager.SecurityProtocol does not include Tls12/Tls13.' }
)

$cleartextProtocol = @(
    @{ Pattern = '"http://(?!localhost)[^"]{5,}"'; Rule = 'SSDLC-06'; Msg = 'Non-localhost HTTP URL (not HTTPS). Use HTTPS for all external communication.' }
    @{ Pattern = "(?i)BaseAddress\s*=\s*new\s+Uri\s*\(\s*""http://"; Rule = 'SSDLC-06'; Msg = 'HttpClient BaseAddress uses HTTP. Must use HTTPS.' }
)

$weakKeySize = @(
    @{ Pattern = '(?i)new\s+RSACryptoServiceProvider\s*\(\s*([0-9]+)\s*\)'; Rule = 'SSDLC-09'; Msg = 'RSA key size — verify it is >= 3072 bits (from 2023+ standard).' }
    @{ Pattern = '(?i)KeySize\s*=\s*(512|1024|2048)\b'; Rule = 'SSDLC-09'; Msg = 'Key size may be below required minimum (RSA: 3072, EC: 256, AES: 256).' }
)

$eosTargets = @(
    @{ Pattern = '<TargetFramework>net[1-5]\.|<TargetFramework>netcoreapp'; Rule = 'SSDLC-08'; Msg = 'Possible end-of-support target framework detected. Verify against current .NET EoS schedule.' }
)

# ── Scan Files ─────────────────────────────────────────────────────────────────

$allPatternGroups = @(
    @{ Patterns = $secretPatterns;        Extensions = @('.cs','.json','.xml','.config','.env','.yaml','.yml') }
    @{ Patterns = $forbiddenAlgorithms;   Extensions = @('.cs') }
    @{ Patterns = $deprecatedTls;         Extensions = @('.cs') }
    @{ Patterns = $cleartextProtocol;     Extensions = @('.cs','.json','.yaml','.yml','.config') }
    @{ Patterns = $weakKeySize;           Extensions = @('.cs') }
    @{ Patterns = $eosTargets;            Extensions = @('.csproj') }
)

foreach ($file in $Files) {
    if (-not (Test-Path $file)) { continue }

    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    $lines = Get-Content $file -ErrorAction SilentlyContinue

    if (-not $lines) { continue }

    foreach ($group in $allPatternGroups) {
        if ($ext -notin $group.Extensions) { continue }

        foreach ($patternDef in $group.Patterns) {
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match $patternDef.Pattern) {
                    # Skip comment lines
                    $trimmed = $lines[$i].Trim()
                    if ($trimmed.StartsWith('//') -or $trimmed.StartsWith('#') -or $trimmed.StartsWith('*')) { continue }

                    Add-Finding `
                        -Rule     $patternDef.Rule `
                        -Severity 'CRITICAL' `
                        -File     $file `
                        -Line     ($i + 1) `
                        -Content  $lines[$i] `
                        -Message  $patternDef.Msg
                }
            }
        }
    }
}

# ── Output ─────────────────────────────────────────────────────────────────────

if ($findings.Count -eq 0) {
    Write-Host ""
    Write-Host "SSDLC-SCAN: PASSED — No automated pattern violations found." -ForegroundColor Green
    Write-Host "NOTE: Proceed with semantic review (AI analysis) for logic-level checks." -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "SSDLC-SCAN: $($findings.Count) finding(s) detected" -ForegroundColor Red
    Write-Host ""

    $criticals = $findings | Where-Object { $_.Severity -eq 'CRITICAL' }
    $warnings  = $findings | Where-Object { $_.Severity -eq 'WARNING' }

    if ($criticals) {
        Write-Host "CRITICAL VIOLATIONS ($($criticals.Count)):" -ForegroundColor Red
        foreach ($f in $criticals) {
            Write-Host "  [$($f.Rule)] $($f.File):$($f.Line)" -ForegroundColor Red
            Write-Host "    MSG : $($f.Message)"
            Write-Host "    CODE: $($f.Content.Substring(0, [Math]::Min(120, $f.Content.Length)))"
            Write-Host ""
        }
    }

    if ($warnings) {
        Write-Host "WARNINGS ($($warnings.Count)):" -ForegroundColor Yellow
        foreach ($f in $warnings) {
            Write-Host "  [$($f.Rule)] $($f.File):$($f.Line) — $($f.Message)" -ForegroundColor Yellow
        }
    }
}

exit $findings.Count
