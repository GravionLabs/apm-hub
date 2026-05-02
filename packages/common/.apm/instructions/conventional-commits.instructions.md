---
applyTo: "**"
---

# Conventional Commits

Always use conventional commit format compatible with [cliff.toml](../../../cliff.toml).

## Format

```
<type>[(<scope>)]: <description>
```

## Types

| Type | Changelog Section | When to use |
|------|------------------|-------------|
| `feat` | Features | New feature or capability |
| `fix` | Bug Fixes | Bug fix |
| `doc` | Documentation | Documentation only |
| `perf` | Performance | Performance improvement |
| `refactor` | Refactoring | Code restructure without behavior change |
| `revert` | Reverts | Reverts a previous commit |
| `chore` | *(skipped)* | Maintenance, deps, housekeeping |
| `ci` | *(skipped)* | CI/CD changes |
| `style` | *(skipped)* | Formatting, whitespace |
| `test` | *(skipped)* | Test additions or fixes |
| `build` | *(skipped)* | Build system changes |

## Rules

- Use **imperative mood**: "add feature" not "added feature"
- **Lowercase** type and description
- **No period** at the end
- Max **72 characters** for the subject line
- Optional scope in parentheses: `feat(github): add pr-body template`

## Branch Naming

| Branch type | Pattern | Example |
|-------------|---------|---------|
| Feature | `feature/<issue-nr>-<slug>` | `feature/42-github-workflow` |
| Bug fix | `bugfix/<issue-nr>-<slug>` | `bugfix/43-fix-pr-title` |
| Hotfix | `hotfix/<issue-nr>-<slug>` | `hotfix/44-critical-fix` |
| Chore | `chore/<slug>` | `chore/update-deps` |

## Examples

```
feat(github): add github-issue-workflow skill
fix(common): correct git branch base ref
doc: update README with new package structure
refactor(apm-workspace): rename skill-audit to apm-skill-audit
chore: update dependencies
```
