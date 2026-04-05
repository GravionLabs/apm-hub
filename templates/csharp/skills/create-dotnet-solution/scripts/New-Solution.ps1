<#
.SYNOPSIS
    Scaffolds a new .NET solution with src/test layout, Central Package Management,
    shared build configuration, and optional CI workflow.

.DESCRIPTION
    Creates a complete .NET solution structure:
      <SolutionName>/
        <SolutionName>.sln
        Directory.Build.props
        Directory.Packages.props
        .editorconfig
        src/
          Directory.Build.props
          <SolutionName>/
            <SolutionName>.csproj
        test/
          Directory.Build.props
          <SolutionName>.Tests/
            <SolutionName>.Tests.csproj
        .github/
          workflows/
            ci.yml

.PARAMETER SolutionName
    Name of the solution and root project.

.PARAMETER ProjectType
    dotnet new template for the source project.
    Defaults to 'classlib'. Options: classlib, console, webapi, worker, grpc.

.PARAMETER OutputType
    'library' for NuGet package (multi-target, ci-library.yml) or
    'app' for executable/service (single-target, ci-app.yml).
    Defaults to 'library'.

.PARAMETER OutputDirectory
    Parent directory where the solution folder is created. Defaults to current directory.

.EXAMPLE
    .\New-Solution.ps1 -SolutionName "Acme.Core" -ProjectType classlib -OutputType library

.EXAMPLE
    .\New-Solution.ps1 -SolutionName "Acme.Api" -ProjectType webapi -OutputType app
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $SolutionName,

    [ValidateSet('classlib', 'console', 'webapi', 'worker', 'grpc')]
    [string] $ProjectType = 'classlib',

    [ValidateSet('library', 'app')]
    [string] $OutputType = 'library',

    [string] $OutputDirectory = '.'
)

$ErrorActionPreference = 'Stop'

$solutionRoot = Join-Path $OutputDirectory $SolutionName
$srcProject   = $SolutionName
$testProject  = "$SolutionName.Tests"

Write-Host "Creating solution '$SolutionName' ($OutputType / $ProjectType) in '$solutionRoot'" -ForegroundColor Cyan

# Create root directory
New-Item -ItemType Directory -Force -Path $solutionRoot | Out-Null
Push-Location $solutionRoot

try {
    # Solution file
    dotnet new sln -n $SolutionName --force

    # Source project
    New-Item -ItemType Directory -Force -Path "src/$srcProject" | Out-Null
    dotnet new $ProjectType -n $srcProject -o "src/$srcProject" --force

    # Test project
    New-Item -ItemType Directory -Force -Path "test/$testProject" | Out-Null
    dotnet new nunit -n $testProject -o "test/$testProject" --force

    # Add projects to solution
    dotnet sln add "src/$srcProject/$srcProject.csproj"
    dotnet sln add "test/$testProject/$testProject.csproj"

    # Copy template files from the skill's templates/ directory
    $templateDir = Join-Path $PSScriptRoot '../templates'

    if (Test-Path $templateDir) {
        Write-Host "Copying build configuration files..." -ForegroundColor Cyan

        $filesToCopy = @(
            'Directory.Build.props',
            'Directory.Packages.props',
            '.editorconfig',
            'src/Directory.Build.props',
            'test/Directory.Build.props'
        )

        foreach ($file in $filesToCopy) {
            $src  = Join-Path $templateDir $file
            $dest = Join-Path $solutionRoot $file
            if (Test-Path $src) {
                $destDir = Split-Path $dest
                New-Item -ItemType Directory -Force -Path $destDir | Out-Null
                Copy-Item -Path $src -Destination $dest -Force
                Write-Host "  Copied $file" -ForegroundColor Gray
            }
        }

        # CI workflow
        $ciTemplate = if ($OutputType -eq 'library') { '.github/workflows/ci-library.yml' } else { '.github/workflows/ci-app.yml' }
        $ciSrc = Join-Path $templateDir $ciTemplate
        if (Test-Path $ciSrc) {
            New-Item -ItemType Directory -Force -Path '.github/workflows' | Out-Null
            $ciDest = '.github/workflows/ci.yml'
            Copy-Item -Path $ciSrc -Destination $ciDest -Force

            # Replace placeholder project name in library CI
            if ($OutputType -eq 'library') {
                (Get-Content $ciDest) -replace '<ProjectName>', $SolutionName | Set-Content $ciDest
            }
            Write-Host "  Copied CI workflow ($OutputType)" -ForegroundColor Gray
        }
    } else {
        Write-Warning "Template directory not found at '$templateDir'. Skipping file copy."
    }

    # Remove Version attributes from .csproj files (CPM manages versions)
    Get-ChildItem -Recurse -Filter '*.csproj' | ForEach-Object {
        $content = Get-Content $_.FullName -Raw
        $updated = $content -replace ' Version="[^"]*"', ''
        if ($content -ne $updated) {
            Set-Content -Path $_.FullName -Value $updated
            Write-Host "  Stripped Version attributes from $($_.Name)" -ForegroundColor Gray
        }
    }

    # Add project reference from test to src
    Push-Location "test/$testProject"
    dotnet add reference "../../src/$srcProject/$srcProject.csproj"
    Pop-Location

    # Verify build
    Write-Host "`nVerifying build..." -ForegroundColor Cyan
    dotnet build

    Write-Host "`nSolution '$SolutionName' created successfully at '$solutionRoot'" -ForegroundColor Green

    if ($OutputType -eq 'library') {
        Write-Host @"

Next steps for library:
  1. Edit Directory.Build.props — adjust target frameworks if needed
  2. Edit Directory.Packages.props — verify package versions
  3. Edit .github/workflows/ci.yml — update verify-package-files section
  4. Create GitVersion.yml for semantic versioning
  5. Add README.md and CHANGELOG.md
"@ -ForegroundColor Yellow
    } else {
        Write-Host @"

Next steps for application:
  1. Edit Directory.Build.props — set TargetFramework (single, not multi-target)
  2. Edit Directory.Packages.props — add application packages
  3. Edit .github/workflows/ci.yml — adjust as needed
"@ -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}
