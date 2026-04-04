---
description: 'Implement a GitHub issue end-to-end: read the issue, determine branch type from labels, create a branch, write code with tests and docs, create atomic commits, and push. Use this to start and implement a new issue.'
mode: agent
tools: ['githubRepo', 'get_issue', 'search_issues', 'editFiles', 'runCommands', 'runTests', 'codebase', 'problems']
argument-hint: '<issue-number>'
---

# Implement Issue

Read a GitHub issue, create the branch, and fully implement it including code, tests, and documentation updates.

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth status`)
- Current directory is the repository root

## Phase 1 — Prepare

### 1. Read the issue

Run `gh issue view {issue-number} --json title,body,labels,assignees` to fetch issue details.

Display a summary:
- **Title**: issue title
- **Labels**: all labels
- **Body**: issue description (truncated if long)

### 2. Determine branch type

Choose the branch prefix based on labels:
- Label contains `bug` → `bugfix/`
- Label contains `hotfix` or `critical` → `hotfix/`
- Otherwise → `feature/`

Derive the short kebab-case title from the issue title (max 5 words, lowercase, hyphens).

Branch name: `{prefix}/{issue-number}-{short-title}`

Examples:
- `feature/18-global-sharing-docs`
- `bugfix/7-ci-push-failure`
- `hotfix/99-security-patch`

### 3. Create and check out the branch

```bash
git checkout -b {branch-name}
```

Confirm the branch was created.

### 4. Output implementation plan

Analyze the issue body and acceptance criteria. Output a structured plan:

```
## Implementation Plan for #{issue-number}

### Branch: {branch-name}

### Changes required
- <file or component>: <what to change>
- ...

### Tests to write
- <test description>

### Docs to update
- <doc or README section if affected>
```

## Phase 2 — Implement

### 5. Analyze the codebase

Search for relevant files, existing patterns, and conventions:
- Understand the existing architecture and naming conventions
- Identify files that need to change
- Check for related tests to understand expected behavior

### 6. Implement changes

Implement all required changes following the project's conventions:
- Write clean, idiomatic code consistent with the codebase
- Follow existing naming, patterns, and structure
- Apply any project-specific instructions (check `.github/instructions/` or `copilot-instructions.md`)

### 7. Write tests

Add or update tests for every changed behavior:
- Unit tests for new functions or classes
- Integration tests where applicable
- Ensure existing tests still pass

Run the test suite: use `npm test`, `dotnet test`, `pytest`, or the appropriate command for the project.

### 8. Update documentation

Update any documentation affected by the change:
- Inline code comments for complex logic
- README or docs if user-facing behavior changes
- Changelog if the project maintains one

### 9. Create atomic commits

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

### 10. Push the branch

```bash
git push -u origin HEAD
```

### 11. Summary

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
Next step: review and create a PR with `/gh-issue-finish {issue-number}`
```
