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

`<type>/<issue-nr>-<slug>` — `<type>` is the conventional-commit type of the issue title (`feat`, `fix`, `docs`, `refactor`, `chore`, …). Epics and Features have no commit type in their title: use `feat`. A batch over several epics: `feat/epics-<nrs>-<slug>`.

Examples: `feat/42-add-pr-skill`, `fix/43-pr-title`, `chore/44-update-deps`.
