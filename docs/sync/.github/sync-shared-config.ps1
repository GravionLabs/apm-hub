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
if ($config.collections) { $fileCount += $config.collections.Count }
if ($config.files) { $fileCount += $config.files.Count }
Write-Host "Items to sync: $fileCount"
Write-Host ""

# Helper function to get collection items from YAML
function Sync-CollectionItems {
    param([string]$CollectionId)
    
    $collectionFileName = if ($CollectionId.EndsWith(".collection.yml")) { $CollectionId } else { "$CollectionId.collection.yml" }
    $sourcePath = "collections/$collectionFileName"
    
    # We need to download the collection YAML to a temporary location to parse it
    $tempYamlPath = Join-Path $env:TEMP ([System.IO.Path]::GetRandomFileName())
    
    Write-Host "→ Fetching collection definition: $collectionFileName"
    if ($sourceType -eq "github") {
        Download-File-GitHub-Explicit $sourcePath $tempYamlPath
    }
    elseif ($sourceType -eq "azure-repos") {
        Download-File-Azure-Explicit $sourcePath $tempYamlPath
    }
    
    if (Test-Path $tempYamlPath) {
        try {
            # Basic YAML parsing for "items:" section using regex since we don't have a YAML parser in standard PowerShell
            $content = Get-Content $tempYamlPath -Raw
            
            # Find the items section
            if ($content -match "(?s)items:\s*\r?\n(.*?)(?:\r?\n\r?\n|\r?\n\w+:|$)") {
                $itemsSection = $matches[1]
                # Extract paths from the items section (look for lines starting with - path: ...)
                $itemPaths = [regex]::Matches($itemsSection, "(?m)^\s*-\s+path:\s*['""]?(.*?)['""]?\s*$") | ForEach-Object { $_.Groups[1].Value }
                
                foreach ($path in $itemPaths) {
                    Write-Host "  → From collection: $path"
                    
                    # Target path depends on whether we are in .github or not
                    if ((Split-Path -Leaf $PWD) -eq ".github") {
                        $destPath = $path
                    }
                    else {
                        $destPath = "$targetDir/$path"
                    }
                    
                    Sync-File $path $destPath
                }
            }
            else {
                Write-Host "  ! No items found in collection $collectionFileName" -ForegroundColor Yellow
            }
        }
        finally {
            Remove-Item $tempYamlPath -ErrorAction SilentlyContinue
        }
    }
}

# Helper function to sync a category
function Sync-Category {
    param(
        [string]$Category,
        [string]$Extension
    )
    
    $items = $config.$Category
    if ($null -eq $items) { return }
    
    foreach ($item in $items) {
        if ($Category -eq "collections") {
            Sync-CollectionItems $item
            continue
        }

        $filename = $item
        if (-not $filename.EndsWith(".$Extension.md")) {
            $filename = "$item.$Extension.md"
        }
        
        $sourcePath = "$Category/$filename"
        $destPath = ""

        # If we are in the .github directory, the target is the current directory
        if ((Split-Path -Leaf $PWD) -eq ".github") {
            $destPath = "$Category/$filename"
        }
        else {
            $destPath = "$targetDir/$Category/$filename"
        }
        
        Sync-File $sourcePath $destPath
    }
}

# Helper function to sync a single file
function Sync-File {
    param(
        [string]$SourcePath,
        [string]$DestPath
    )

    $dir = Split-Path -Path $DestPath -Parent
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    
    Write-Host "→ Syncing file: $SourcePath"
    
    if ($sourceType -eq "github") {
        Download-File-GitHub-Explicit $SourcePath $DestPath
    }
    elseif ($sourceType -eq "azure-repos") {
        Download-File-Azure-Explicit $SourcePath $DestPath
    }
}

# Explicit download helpers
function Download-File-GitHub-Explicit {
    param([string]$SourcePath, [string]$DestPath)
    
    $headers = @{}
    if ($env:GITHUB_TOKEN) {
        # Use GitHub API for private repos when token is provided
        $url = "https://api.github.com/repos/$sourceOrg/$sourceRepo/contents/$sourceDir/$SourcePath?ref=$sourceBranch"
        $headers.Add("Authorization", "Bearer $($env:GITHUB_TOKEN)")
        $headers.Add("Accept", "application/vnd.github.v3.raw")
    }
    else {
        # Use raw.githubusercontent.com for public repos (no token needed)
        $url = "https://raw.githubusercontent.com/$sourceOrg/$sourceRepo/$sourceBranch/$sourceDir/$SourcePath"
    }
    
    try {
        Write-Host "  Downloading from $url"
        if ($headers.Count -gt 0) {
            Invoke-WebRequest -Uri $url -OutFile $DestPath -Headers $headers -UseBasicParsing
        }
        else {
            Invoke-WebRequest -Uri $url -OutFile $DestPath -UseBasicParsing
        }
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
Sync-Category "collections" "collection"

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
