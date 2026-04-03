---
description: 'Branch and PR conventions for working on GitHub issues: naming, commits, and pull request format'
applyTo: '**'
---

## Issue Workflow

When working on a GitHub issue, always follow these conventions.

### Branch Naming

Create a branch with the following format:

```
feat/issue-{number}-{short-kebab-title}
```

Examples:
- `feat/issue-18-global-sharing-docs`
- `feat/issue-42-add-python-plugin`
- `fix/issue-7-ci-push-failure`

Use `fix/` prefix for bug fixes, `feat/` for new features or documentation additions, `chore/` for maintenance tasks.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description> (closes #<number>)
```

Examples:
- `feat: add global-sharing.md guide (closes #18)`
- `fix: correct branch protection bypass (closes #7)`
- `docs: update skills.md with global path clarification (closes #20)`

For multi-commit work, include the issue reference in the final commit or the PR body.

### Pull Request

- **Title**: Match the final commit message subject (without the `closes #N` part)
- **Body**: Always include `Closes #<number>` to auto-close the issue on merge
- **Branch**: Must come from the `feat/issue-{number}-*` branch (never commit directly to `main`)

PR body template:

```markdown
## Summary

<Short description of what this PR does>

## Changes

- <change 1>
- <change 2>

Closes #<issue-number>
```

### Checklist

Before opening a PR:
- [ ] Branch name follows `feat/issue-{number}-{title}` convention
- [ ] At least one commit references the issue number
- [ ] PR body contains `Closes #<number>`
- [ ] Generated files are up to date (`npm run generate:all` if applicable)
