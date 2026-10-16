#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Command prefixes the narrow permission set of every adapter allows (single source for claude, copilot, opencode).
.DESCRIPTION
  git and gh are limited to the subcommands the pipeline uses; this is a list of prefixes, not a sandbox. 'gh api' stays
  allowed (sub-issue and blocked-by linking need it, also POST/GraphQL) and can do what 'gh pr merge' does; 'git push'
  also matches a forced push (the git guardrails hook denies force pushes to main and release/*); pwsh and the build
  tools run arbitrary code. The narrow set limits accidents, it does not stop prompt injection.
.OUTPUTS string[] of command prefixes, e.g. 'git status', 'pnpm'.
#>
'git status', 'git diff', 'git log', 'git show', 'git add', 'git commit', 'git checkout', 'git switch', 'git branch',
'git fetch', 'git push', 'git rev-parse', 'git rev-list', 'git merge-base', 'git ls-files', 'git remote',
'gh issue view', 'gh issue list', 'gh issue create', 'gh issue edit', 'gh issue close', 'gh issue comment',
'gh pr create', 'gh pr view', 'gh pr list', 'gh pr diff', 'gh repo view', 'gh api',
'pwsh', 'pnpm', 'npm', 'npx', 'node', 'dotnet', 'uv', 'python', 'ng'
