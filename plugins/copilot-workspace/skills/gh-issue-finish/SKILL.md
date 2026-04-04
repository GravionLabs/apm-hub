---
name: gh-issue-finish
description: 'Finish working on a GitHub issue: run build and tests, perform a code review of all changes, then create a pull request. Use this after gh-issue-implement when the implementation is complete.'
---

# Finish Issue

Review the implementation and create a pull request for a GitHub issue.

## Prerequisites

- Issue is implemented (run `/gh-issue-implement {issue-number}` first)
- Branch is pushed to origin
- Current directory is the repository root

## Steps

### 1. Verify build and tests pass

Run the full build and test suite for the project:
- **Node.js**: `npm run build && npm test`
- **.NET**: `dotnet build && dotnet test`
- **Python**: `pytest`
- **Other**: use the project's documented build/test command

Fix any failures before continuing.

### 2. Code review

Analyze all changes compared to the base branch:

```bash
git diff origin/main...HEAD
```

Review for:
- **Correctness**: does the implementation match the issue requirements?
- **Edge cases**: are error conditions handled?
- **Code quality**: naming, readability, consistency with codebase
- **Test coverage**: are the important paths tested?
- **Security**: no secrets, no unsafe operations
- **Performance**: no obvious inefficiencies

Create a final fix commit if issues are found:
```bash
git commit -m "fix: address review findings (refs #{issue-number})"
git push
```

### 3. Create the pull request

```bash
gh pr create \
  --title "<description>" \
  --body "## Summary

<Short description of what this PR does>

## Changes

- <change 1>
- <change 2>

Closes #{issue-number}" \
  --base main
```

PR title should match the final commit subject (without the issue reference).

### 4. Summary

Output the PR URL and a brief status:
```
✅ Pull request created: <PR URL>

Branch: {branch-name}
Closes: #{issue-number}
```
