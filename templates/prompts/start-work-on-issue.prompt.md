---
description: 'Start working on a GitHub issue: read the issue, determine branch type from labels, create a branch, and output an implementation plan. Use this when starting work on a new issue.'
mode: agent
tools: ['githubRepo', 'get_issue', 'search_issues', 'runCommands', 'codebase']
argument-hint: '<issue-number>'
---

# Start Work on Issue

Prepare the local environment to work on a GitHub issue.

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth status`)
- Current directory is the repository root

## Steps

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

---
Next step: implement the changes with `/implement-issue {issue-number}`
```
