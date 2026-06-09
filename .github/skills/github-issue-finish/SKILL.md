---
name: github-issue-finish
description: 'Review implementation and create a GitHub pull request. Run after github-issue-start when implementation is complete.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase mcp_github_create_pull_request mcp_github_get_issue
chronicle-hints: 'single-purpose, structured-output, phases'
---

Review the implementation and open a pull request for a GitHub issue.

## Prerequisites
- Issue is implemented (`github-issue-start` completed)
- Branch is pushed to origin
- Run from the repository root

## Steps

### Phase 1 — Verify

✓ Checkpoint: Build and tests green; ready for review

1. Run the full build and test suite for the project. Fix any failures before continuing.
2. Run `git diff main...HEAD` — review all changes
3. Check for: leftover debug code, missing error handling, incomplete TODOs, missing tests

### Phase 2 — Create PR

✓ Checkpoint: PR created and CI running

4. Create the pull request (choose one):

   *Preferred — agent:*
   ```powershell
   # Use @github-pull-request agent to auto-generate
   @github-pull-request {issue-number}
   ```

   *Alternative — MCP:*
   ```powershell
   # Call mcp_github_create_pull_request with:
   # - title: "<type>: <description> (#<issue-number>)"
   # - body: "Closes #<issue-number>\n\n<summary>"
   # - head: <current-branch>
   # - base: "main"
   ```

   *Fallback — gh CLI:*
   ```powershell
   gh pr create `
     --title "<type>: <description> (#<issue-number>)" `
     --body "Closes #<issue-number>`n`n$(Get-Content templates/pr-body.md)"
   ```

### Phase 3 — Confirm

✓ Checkpoint: PR linked and CI status checked; ready for review

5. Verify the PR link is accessible: `gh pr view`
6. Check CI status: `gh pr checks` — confirm all checks are running or green

## Constraints
- PR title must reference the issue number
- All CI checks should be green before requesting review
- Link the issue with `Closes #<issue-number>` in the PR body

## Gotchas
- Don't create the PR until tests pass locally
- Always include `Closes #<issue-number>` in body so GitHub auto-closes issue
- Use PR title format: `<type>: <description> (#<issue-number>)` — include parentheses
- Don't wait for CI to complete; just confirm it's running

## Output Format

### ✅ Summary
PR #`{pr-number}` created for issue #`{issue-number}` on branch `{branch-name}`.

### 📝 What Changed
- PR URL: `{pr-url}`
- Title: `{pr-title}`
- Issue link: `Closes #{issue-number}` (auto-close configured)
- CI status: {status} (Running / All Green / {X failed})
- Files: {count} ({total lines changed})

### ✔️ Verify
```powershell
# Open PR in browser
gh pr view --web

# Check CI status
gh pr checks

# Verify issue is linked
gh pr view | Select-String "Closes #"
```

### 🚀 Next Steps
1. Share PR link with team
2. Monitor CI checks — fix any failures
3. Request review from code owners
4. Once approved, merge or rebase and merge (depends on project policy)
