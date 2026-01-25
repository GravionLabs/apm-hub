# Shared Configuration Sync Script (PowerShell)
# Synchronizes shared .github configuration files from a central repository.

$ErrorActionPreference = "Stop"

$configFile = ".github/sync-config.json"

if (-not (Test-Path $configFile)) {
    Write-Error "Sync configuration file $configFile not found."
    exit 1
}

Write-Host "Reading configuration from $configFile..."

$config = Get-Content $configFile | ConvertFrom-Json

$sourceType = $config.source.type
$sourceOrg = $config.source.org
$sourceRepo = $config.source.repo
$sourceBranch = $config.source.branch
$sourceProject = $config.source.project

Write-Host "Source: $sourceType"
Write-Host "Organization: $sourceOrg"
Write-Host "Repository: $sourceRepo"
Write-Host "Branch: $sourceBranch"

$files = $config.files
Write-Host "Files to sync: $($files.Count)"
Write-Host ""

foreach ($fileEntry in $files) {
    $sourceFile = $fileEntry.source
    $destFile = $fileEntry.dest
    
    if (-not $destFile) {
        $destFile = $sourceFile
    }

    Write-Host "→ Syncing: $sourceFile to $destFile"
    
    # Create directory if it doesn't exist
    $dir = Split-Path -Path $destFile -Parent
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    
    if ($sourceType -eq "github") {
        # GitHub Raw Content
        $url = "https://raw.githubusercontent.com/$sourceOrg/$sourceRepo/$sourceBranch/$sourceFile"
        try {
            Invoke-WebRequest -Uri $url -OutFile $destFile -UseBasicParsing
            Write-Host "  ✓ Downloaded successfully"
        }
        catch {
            Write-Host "  ✗ Failed: $($_.Exception.Message)"
            exit 1
        }
    }
    elseif ($sourceType -eq "azure-repos") {
        # Azure DevOps REST API
        if (-not $sourceProject) {
            Write-Host "  ✗ Error: source.project is required for azure-repos"
            exit 1
        }
        
        $apiUrl = "https://dev.azure.com/$sourceOrg/$sourceProject/_apis/git/repositories/$sourceRepo/items"
        $apiUrl += "?path=/$sourceFile&versionType=branch&version=$sourceBranch&api-version=7.0"
        
        $headers = @{}
        if ($env:AZURE_PERSONAL_ACCESS_TOKEN) {
            $base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$($env:AZURE_PERSONAL_ACCESS_TOKEN)"))
            $headers.Add("Authorization", "Basic $base64AuthInfo")
        }
        
        try {
            Invoke-WebRequest -Uri $apiUrl -OutFile $destFile -Headers $headers -UseBasicParsing
            Write-Host "  ✓ Downloaded successfully"
        }
        catch {
            Write-Host "  ✗ Failed: $($_.Exception.Message)"
            exit 1
        }
    }
    else {
        Write-Host "  ✗ Error: Unknown source type: $sourceType"
        exit 1
    }
}

Write-Host ""
Write-Host "✓ All files synced successfully"
