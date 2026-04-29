---
applyTo: "**"
---

# GitHub CLI Context

This project uses the GitHub CLI (`gh`) for pull request creation, issue management, and repository operations. The `common-github-pull-request` agent provides workflows for creating pull requests and linking issues.

## GitHub CLI Setup

Ensure `gh` is installed and authenticated:

```powershell
# Check installation
gh version

# Authenticate (if needed)
gh auth login
```

## Available Commands

| Command | Purpose |
|---------|---------|
| `gh pr create` | Create a pull request |
| `gh issue view <number>` | View issue details |
| `gh pr view <number>` | View pull request details |
| `gh pr comment <number> -b "<body>"` | Add comment to PR |

## Pull Request Workflow

When creating a pull request:

1. **Push your branch first** (required):
   ```powershell
   git push --set-upstream origin <branch-name>
   ```

2. **Create the PR** with title and description:
   ```powershell
   gh pr create --title "#<number> Title" --body "PR description" --base main
   ```

3. **Link the issue** using `Closes #<number>` in the PR description. The issue auto-closes when the PR is merged.

## Rules

- Always use the format `#<IssueNumber>` in PR titles
- Include `Closes #<IssueNumber>` in PR descriptions to auto-link
- All PR titles and descriptions MUST be in English
- Never manually close issues — let GitHub auto-close them via merged PRs
