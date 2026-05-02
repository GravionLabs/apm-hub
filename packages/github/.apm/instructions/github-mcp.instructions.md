---
applyTo: "**"
---

# GitHub MCP Server

This project uses the GitHub MCP server. Prefer MCP tools over the `gh` CLI when available.

## Available MCP Tools

| Domain | Tools |
|--------|-------|
| Issues | `github_get_issue`, `github_create_issue`, `github_update_issue`, `github_list_issues` |
| Pull Requests | `github_create_pull_request`, `github_list_pull_requests`, `github_get_pull_request` |
| Branches | `github_create_branch`, `github_list_branches` |
| Commits | `github_list_commits`, `github_get_commit` |
| Repositories | `github_get_repository`, `github_search_repositories` |
| Search | `github_search_code`, `github_search_issues` |

## When to use MCP vs gh CLI

- **Use MCP** for API operations: creating/reading issues, PRs, branches
- **Use `gh` CLI as fallback** when MCP tools are unavailable
- **Use `git` CLI** for local operations: checkout, stage, commit, push

## Setup

The GitHub MCP server is configured via `apm install --mcp github`. After install, tools are available as `github_*` in agent/skill sessions.
