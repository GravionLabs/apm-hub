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

$fileCount = 0
if ($config.instructions) { $fileCount += $config.instructions.Count }
if ($config.prompts) { $fileCount += $config.prompts.Count }
if ($config.agents) { $fileCount += $config.agents.Count }
if ($config.files) { $fileCount += $config.files.Count }
Write-Host "Files to sync: $fileCount"
Write-Host ""

# Helper function to sync a category
function Sync-Category {
    param(
        [string]$Category,
        [string]$Extension
    )
    
    $items = $config.$Category
    if ($null -eq $items) { return }
    
    foreach ($item in $items) {
        $filename = $item
        if (-not $filename.EndsWith(".$Extension.md")) {
            $filename = "$item.$Extension.md"
        }
        
        $sourcePath = "$Category/$filename"
        
        # If we are in the .github directory, the target is the current directory
        if ((Split-Path -Leaf $PWD) -eq ".github") {
            $destPath = "$Category/$filename"
        }
        else {
            $destPath = "$targetDir/$Category/$filename"
        }
        
        $dir = Split-Path -Path $destPath -Parent
        if ($dir -and -not (Test-Path $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
        
        Write-Host "→ Syncing $Category: $filename"
        
        if ($sourceType -eq "github") {
            Download-File-GitHub-Explicit $sourcePath $destPath
        }
        elseif ($sourceType -eq "azure-repos") {
            Download-File-Azure-Explicit $sourcePath $destPath
        }
    }
}

# Explicit download helpers
function Download-File-GitHub-Explicit {
    param([string]$SourcePath, [string]$DestPath)
    $url = "https://raw.githubusercontent.com/$sourceOrg/$sourceRepo/$sourceBranch/$sourceDir/$SourcePath"
    try {
        Invoke-WebRequest -Uri $url -OutFile $DestPath -UseBasicParsing
        Write-Host "  ✓ Downloaded"
    }
    catch {
        Write-Host "  ✗ Failed: $($_.Exception.Message)"
    }
}

function Download-File-Azure-Explicit {
    param([string]$SourcePath, [string]$DestPath)
    $apiUrl = "https://dev.azure.com/$sourceOrg/$sourceProject/_apis/git/repositories/$sourceRepo/items"
    $apiUrl += "?path=/$sourceDir/$SourcePath&versionType=branch&version=$sourceBranch&api-version=7.0"
    $headers = @{}
    if ($env:AZURE_PERSONAL_ACCESS_TOKEN) {
        $base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$($env:AZURE_PERSONAL_ACCESS_TOKEN)"))
        $headers.Add("Authorization", "Basic $base64AuthInfo")
    }
    try {
        Invoke-WebRequest -Uri $apiUrl -OutFile $DestPath -Headers $headers -UseBasicParsing
        Write-Host "  ✓ Downloaded"
    }
    catch {
        Write-Host "  ✗ Failed: $($_.Exception.Message)"
    }
}

Write-Host "Syncing files..."
Write-Host ""

Sync-Category "instructions" "instructions"
Sync-Category "prompts" "prompt"
Sync-Category "agents" "agent"

# Legacy support
if ($config.files) {
    foreach ($file in $config.files) {
        Write-Host "→ Syncing legacy file: $file"
        
        # If we are in the .github directory, the target is the current directory
        if ((Split-Path -Leaf $PWD) -eq ".github") {
            $destPath = $file
        }
        else {
            $destPath = "$targetDir/$file"
        }
        
        $dir = Split-Path -Path $destPath -Parent
        if ($dir -and -not (Test-Path $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }

        if ($sourceType -eq "github") {
            Download-File-GitHub-Explicit "$file" "$destPath"
        }
        elseif ($sourceType -eq "azure-repos") {
            Download-File-Azure-Explicit "$file" "$destPath"
        }
    }
}

Write-Host ""
Write-Host "✓ All files synced successfully"
