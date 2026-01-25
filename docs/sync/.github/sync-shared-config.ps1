# Shared Configuration Sync Script (PowerShell)
# Synchronizes shared .github configuration files from a central repository.

$ErrorActionPreference = "Stop"

# Try to find the config file in the current directory or .github/
if (Test-Path "sync-config.json") {
    $configFile = "sync-config.json"
}
elseif (Test-Path ".github/sync-config.json") {
    $configFile = ".github/sync-config.json"
}
else {
    Write-Error "Sync configuration file (sync-config.json or .github/sync-config.json) not found."
    exit 1
}

Write-Host "Reading configuration from $configFile..."

$config = Get-Content $configFile | ConvertFrom-Json

$sourceType = $config.syncSettings.type
$sourceOrg = $config.syncSettings.org
$sourceRepo = $config.syncSettings.repo
$sourceBranch = $config.syncSettings.branch
$sourceProject = $config.syncSettings.project
$sourceDir = if ($config.syncSettings.sourceDir) { $config.syncSettings.sourceDir } else { "templates" }
$targetDir = if ($config.syncSettings.targetDir) { $config.syncSettings.targetDir } else { ".github" }

Write-Host "Source: $sourceType"
Write-Host "Organization: $sourceOrg"
Write-Host "Repository: $sourceRepo"
Write-Host "Branch: $sourceBranch"
Write-Host "Source Directory: $sourceDir"
Write-Host "Target Directory: $targetDir"

$fileCount = $config.files.Count
Write-Host "Files to sync: $fileCount"
Write-Host ""

# Helper function to download a file from GitHub
function Download-File-GitHub {
    param(
        [string]$RelativePath
    )
    
    $sourcePath = "$sourceDir/$RelativePath"
    
    # If we are in the .github directory, the target is the current directory
    if ((Split-Path -Leaf $PWD) -eq ".github") {
        $destPath = $RelativePath
    }
    else {
        $destPath = "$targetDir/$RelativePath"
    }
    
    $dir = Split-Path -Path $destPath -Parent
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    
    $url = "https://raw.githubusercontent.com/$sourceOrg/$sourceRepo/$sourceBranch/$sourcePath"
    try {
        Invoke-WebRequest -Uri $url -OutFile $destPath -UseBasicParsing
        Write-Host "  ✓ Downloaded: $destPath"
        return $true
    }
    catch {
        Write-Host "  ✗ Failed: $($_.Exception.Message)"
        return $false
    }
}

# Helper function to download a file from Azure DevOps
function Download-File-Azure {
    param(
        [string]$RelativePath
    )
    
    if (-not $sourceProject) {
        Write-Host "  ✗ Error: source.project is required for azure-repos"
        return $false
    }
    
    $sourcePath = "$sourceDir/$RelativePath"
    
    # If we are in the .github directory, the target is the current directory
    if ((Split-Path -Leaf $PWD) -eq ".github") {
        $destPath = $RelativePath
    }
    else {
        $destPath = "$targetDir/$RelativePath"
    }
    
    $dir = Split-Path -Path $destPath -Parent
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    $apiUrl = "https://dev.azure.com/$sourceOrg/$sourceProject/_apis/git/repositories/$sourceRepo/items"
    $apiUrl += "?path=/$sourcePath&versionType=branch&version=$sourceBranch&api-version=7.0"

    $headers = @{}
    if ($env:AZURE_PERSONAL_ACCESS_TOKEN) {
        $base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$($env:AZURE_PERSONAL_ACCESS_TOKEN)"))
        $headers.Add("Authorization", "Basic $base64AuthInfo")
    }

    try {
        Invoke-WebRequest -Uri $apiUrl -OutFile $destPath -Headers $headers -UseBasicParsing
        Write-Host "  ✓ Downloaded: $destPath"
        return $true
    }
    catch {
        Write-Host "  ✗ Failed: $($_.Exception.Message)"
        return $false
    }
}

Write-Host "Syncing files..."
Write-Host ""

foreach ($file in $config.files) {
    Write-Host "→ Syncing: $file"

    if ($sourceType -eq "github") {
        Download-File-GitHub $file
    }
    elseif ($sourceType -eq "azure-repos") {
        Download-File-Azure $file
    }
    else {
        Write-Host "  ✗ Error: Unknown source type: $sourceType"
        exit 1
    }
}

Write-Host ""
Write-Host "✓ All files synced successfully"
