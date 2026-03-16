param(
    [Parameter(Mandatory=$true)]
    [string]$SolutionPath,

    [Parameter(Mandatory=$true)]
    [string]$FolderToSync
)

# Load XML
[xml]$xml = Get-Content $SolutionPath

# Validate root
$solution = $xml.Solution
if (-not $solution) {
    Write-Error "Invalid .slnx file."
    exit 1
}

# Normalize folder name
$folderName = Split-Path $FolderToSync -Leaf

# Find or create SolutionFolder
$folderNode = $solution.SolutionFolder | Where-Object { $_.Name -eq $folderName }
if (-not $folderNode) {
    $folderNode = $xml.CreateElement("SolutionFolder")
    $folderNode.SetAttribute("Name", $folderName)
    $solution.AppendChild($folderNode) | Out-Null
}

# Remove old items
$oldItems = $folderNode.SolutionItem
foreach ($item in $oldItems) {
    $folderNode.RemoveChild($item) | Out-Null
}

# Collect files
$basePath = (Get-Location).Path + "\"
$files = Get-ChildItem -Path $FolderToSync -Recurse -File

foreach ($file in $files) {
    $relative = $file.FullName.Replace($basePath, "")
    $item = $xml.CreateElement("SolutionItem")
    $item.SetAttribute("Include", $relative)
    $folderNode.AppendChild($item) | Out-Null
}

# Save XML
$xml.Save($SolutionPath)

Write-Host "Synchronized: $FolderToSync → $SolutionPath"
