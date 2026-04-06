<#
.SYNOPSIS
  Fetch a GitHub issue, derive the branch name, and create + checkout the branch.

.PARAMETER IssueNumber
  The GitHub issue number to start work on.

.PARAMETER Owner
  Repository owner. Defaults to the current repo's owner (detected via gh).

.PARAMETER Repo
  Repository name. Defaults to the current repo (detected via gh).
#>
param(
  [Parameter(Mandatory)][int]$IssueNumber,
  [string]$Owner,
  [string]$Repo
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "gh CLI not found. Install it from https://cli.github.com/ and run 'gh auth login'."
}

# Detect repo if not provided
if (-not $Owner -or -not $Repo) {
  $repoInfo = gh repo view --json owner,name | ConvertFrom-Json
  if (-not $Owner) { $Owner = $repoInfo.owner.login }
  if (-not $Repo)  { $Repo  = $repoInfo.name }
}

Write-Host "Fetching issue #$IssueNumber from $Owner/$Repo..." -ForegroundColor Cyan

$issue = gh issue view $IssueNumber --repo "$Owner/$Repo" --json number,title,labels | ConvertFrom-Json

$title  = $issue.title
$labels = $issue.labels | ForEach-Object { $_.name }

# Determine branch prefix from labels
$prefix = 'feature'
if ($labels -contains 'hotfix')                                    { $prefix = 'hotfix' }
elseif ($labels -contains 'bug' -or $labels -contains 'fix')       { $prefix = 'bugfix' }
elseif ($labels -contains 'chore' -or $labels -contains 'ci')      { $prefix = 'chore'  }

# Build slug from title: lowercase, alphanumeric + hyphens, max 50 chars
$slug = $title.ToLower() -replace '[^a-z0-9]+', '-' -replace '^-|-$', ''
if ($slug.Length -gt 50) { $slug = $slug.Substring(0, 50).TrimEnd('-') }

$branch = "$prefix/$IssueNumber-$slug"

Write-Host "Issue: [$($issue.number)] $title" -ForegroundColor White
Write-Host "Branch: $branch" -ForegroundColor Yellow

# Check if branch already exists
$existing = git branch --list $branch
if ($existing) {
  Write-Host "Branch already exists — checking it out" -ForegroundColor DarkYellow
  git checkout $branch
} else {
  git checkout -b $branch
  Write-Host "Created and checked out branch: $branch" -ForegroundColor Green
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Explore the codebase to understand affected areas"
Write-Host "  2. Implement the changes, write tests"
Write-Host "  3. git push -u origin HEAD"
Write-Host "  4. Run 'gh-issue-finish $IssueNumber' to create the PR"
