# Conventional Commits

Always use conventional commit format.

## Format

```
<type>[(<scope>)]: <description>
```

## Types

| Type       | When to use                              |
|------------|------------------------------------------|
| `feat`     | New feature or capability                |
| `fix`      | Bug fix                                  |
| `docs`     | Documentation only                       |
| `perf`     | Performance improvement                  |
| `refactor` | Code restructure without behavior change |
| `revert`   | Reverts a previous commit                |
| `chore`    | Maintenance, deps, housekeeping          |
| `ci`       | CI/CD changes                            |
| `style`    | Formatting, whitespace                   |
| `test`     | Test additions or fixes                  |
| `build`    | Build system changes                     |

## Rules

- Imperative mood: "add feature" not "added feature"
- Lowercase type and description
- No period at the end
- Max 72 characters for subject line
- Optional scope in parentheses

## Branch Naming

| Branch type | Pattern                     | Example                      |
|-------------|-----------------------------|------------------------------|
| Feature     | `feature/<issue-nr>-<slug>` | `feature/42-add-pr-skill` |
| Bug fix     | `bugfix/<issue-nr>-<slug>`  | `bugfix/43-fix-pr-title`     |
| Hotfix      | `hotfix/<issue-nr>-<slug>`  | `hotfix/44-critical-fix`     |
| Chore       | `chore/<slug>`              | `chore/update-deps`          |
