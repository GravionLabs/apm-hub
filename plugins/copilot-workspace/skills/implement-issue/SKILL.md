---
name: implement-issue
description: 'Implement a GitHub issue: write code, tests, and documentation updates, then create atomic commits with proper references. Use this after start-work-on-issue to implement the actual changes.'
allowed-tools: get_issue editFiles runCommands runTests codebase problems
argument-hint: <issue-number>
---

# Implement Issue

Fully implement a GitHub issue including code, tests, and documentation updates.

## Prerequisites

- Branch already created (run `/start-work-on-issue {issue-number}` first)
- Current directory is the repository root

## Steps

### 1. Re-read the issue

Run `gh issue view {issue-number} --json title,body,labels` to confirm requirements and acceptance criteria.

### 2. Analyze the codebase

Search for relevant files, existing patterns, and conventions:
- Understand the existing architecture and naming conventions
- Identify files that need to change
- Check for related tests to understand expected behavior

### 3. Implement changes

Implement all required changes following the project's conventions:
- Write clean, idiomatic code consistent with the codebase
- Follow existing naming, patterns, and structure
- Apply any project-specific instructions (check `.github/instructions/` or `copilot-instructions.md`)

### 4. Write tests

Add or update tests for every changed behavior:
- Unit tests for new functions or classes
- Integration tests where applicable
- Ensure existing tests still pass

Run the test suite: use `npm test`, `dotnet test`, `pytest`, or the appropriate command for the project.

### 5. Update documentation

Update any documentation affected by the change:
- Inline code comments for complex logic
- README or docs if user-facing behavior changes
- Changelog if the project maintains one

### 6. Create atomic commits

Create one commit per logical change, referencing the issue:

```bash
git add <files>
git commit -m "feat: <description> (refs #{issue-number})"
```

Commit conventions:
- `feat:` — new feature or capability
- `fix:` — bug fix
- `docs:` — documentation only
- `test:` — tests only
- `refactor:` — refactoring without behavior change
- `chore:` — maintenance, build, or tooling

### 7. Push the branch

```bash
git push -u origin HEAD
```

### 8. Summary

Output a summary of all changes made:
```
## Implementation Summary for #{issue-number}

### Files changed
- <file>: <what changed>

### Tests added/updated
- <test file>: <what is tested>

### Commits
- <commit hash>: <message>

---
Next step: review and create a PR with `/finish-work-on-issue {issue-number}`
```
