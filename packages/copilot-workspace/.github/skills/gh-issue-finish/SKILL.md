---
name: gh-issue-finish
description: 'Review implemented changes and create a pull request for a GitHub issue. Run this after gh-issue-implement when the implementation is complete.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: gpt-4.1
---

Review the implementation and open a pull request for a GitHub issue.

## Prerequisites
- Issue is implemented (`gh-issue-implement` completed)
- Branch is pushed to origin
- Run from the repository root

## Steps

### 1. Verify build and tests
Run the full build and test suite for the project. Fix any failures before continuing.

### 2. Self-review changes
- `git diff main...HEAD` — review all changes
- Check for: leftover debug code, missing error handling, incomplete TODOs, missing tests

### 3. Create the pull request
```bash
gh pr create \
  --title "<type>: <description> (#<issue-number>)" \
  --body "$(cat <<'EOF'
## Summary
<what changed and why>

## Changes
- <bullet list of changes>

## Testing
- <how it was tested>

Closes #<issue-number>
EOF
)"
```

### 4. Confirm
- Verify the PR link is accessible
- Check CI status: `gh pr checks`

## Constraints
- PR title must reference the issue number
- All CI checks should be green before requesting review
- Link the issue with `Closes #<issue-number>` in the PR body

> 💡 **Model hint:** This is a mechanical task — a fast model like `gpt-4.1` is sufficient. Use `/model` to switch.
