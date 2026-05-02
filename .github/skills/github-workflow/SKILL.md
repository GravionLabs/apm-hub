---
name: github-workflow
description: "Generic GitHub workflow — creates pull requests, links issues, and manages GitHub-based development. Use this skill for any GitHub PR or issue linking operation. Preferred model: gpt-4.1."
model: gpt-4.1
allowed-tools: shell mcp_github_create_pull_request mcp_github_list_pull_requests
---

## Instructions

This skill manages GitHub workflows using the GitHub MCP server or `gh` CLI as fallback. It coordinates between git operations and GitHub PR/issue management.

### Prerequisites

- GitHub CLI (`gh`) must be installed
- User must be authenticated: `gh auth login`
- Current working directory must be a git repository with a GitHub remote

### Create Pull Request

When asked to create a PR (PR title, description, and issue link are always provided by the caller):

*Primary — MCP:*
```
mcp_github_create_pull_request(
  owner: <owner>,
  repo: <repo>,
  title: "#<IssueNumber> <Title>",
  body: "<Description with 'Closes #<IssueNumber>' for auto-linking>",
  head: <branch>,
  base: "main"
)
```

*Fallback — gh CLI (when MCP not available):*
```powershell
# Verify current branch
git branch --show-current

# Create PR with title and description
gh pr create \
  --title "#<IssueNumber> <Title>" \
  --body "<Description with 'Closes #<IssueNumber>' for auto-linking>" \
  --base main
```

- Always base the PR on `main`, never on a different branch unless explicitly instructed.
- The `Closes #<IssueNumber>` mention in the description creates an automatic link; the issue will auto-close when the PR is merged.
- Confirm the PR number and URL after creation.

### Verify Issue Link

When asked to verify a PR is linked to an issue:

*Primary — MCP:*
```
mcp_github_list_pull_requests(owner: <owner>, repo: <repo>)
```
Find the PR and check the body for `Closes #<IssueNumber>`.

*Fallback — gh CLI:*
```powershell
gh pr view <pr-number> --json body
```

- Check if the body contains `Closes #<IssueNumber>` or similar linking syntax.
- The issue auto-closes when the PR is merged — do not manually resolve the issue.

### View PR Details

When asked to view PR information:

```powershell
gh pr view <pr-number> --json title,body,number,url,state
```

### Rules
- **All PR titles and descriptions MUST be in English.** Translate from German or any other language before creating.
- Never manually close issues — GitHub auto-closes them via merged PRs.
- Always verify the branch is pushed before creating a PR (`git push --set-upstream origin <branch-name>`).
- Run all commands in the current working directory.
- Never modify source files — only manage git and GitHub operations.
