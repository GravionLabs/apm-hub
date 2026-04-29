# Agents Overview

This document describes the agents available through Copilot Hub plugins. Agents are specialized roles that handle specific workflows and can be used via Copilot (via @-mentions or slash commands).

## Common Plugin (`plugins/common`)

### Git & GitHub Workflow

#### `common-github-pull-request`

**Location:** `templates/common/github/agents/common-github-pull-request.agent.md`

**Purpose:** Creates a GitHub Pull Request for the current branch, generates a proper title (containing the issue number), builds a structured markdown description, and auto-links the GitHub issue.

**When to use:**
- After committing and pushing a branch to GitHub
- When you need to create a PR and automatically link a GitHub issue
- For standardized PR workflows with proper issue linking

**Tools required:**
- `gh/*` (GitHub CLI tools)
- `run_in_terminal` (for git and gh commands)

**Model:** GPT-4.1

**User-invocable:** No (called by workflows that need PR creation)

**Key features:**
- Extracts issue number and title from context
- Generates standardized PR titles: `#<IssueNumber> <Title>`
- Builds structured Markdown PR descriptions with Summary, Changes, and Testing sections
- Auto-links issues using `Closes #<IssueNumber>` (auto-closes issue when merged)
- Confirms PR creation with URL and linking status

---

#### `common-git-workflow`

**Location:** `templates/common/git/skills/common-git-workflow/SKILL.md`

**Purpose:** Executes precise git operations — fetches from origin/main, creates branches, stages files, creates structured commits, and pushes to remote.

**When to use:**
- For any git branch, commit, or push operation
- When you need reliable, scripted git workflows
- For standardized commit messages and branch creation

**Tools required:**
- `shell` (PowerShell for git commands)

**Model:** GPT-4.1

**User-invocable:** Yes (foundational skill used by higher-level workflows)

**Key features:**
- Fetch origin/main reliably
- Create branches based on origin/main (never local main)
- Stage files and create commits with structured messages
- Push branches to remote with proper upstream tracking
- Enforces English-only branch names and commit messages (auto-translates if needed)
- Validates operations and reports results

---

#### `common-github-workflow`

**Location:** `templates/common/github/skills/common-github-workflow/SKILL.md`

**Purpose:** Manages GitHub workflows using the `gh` CLI — creates pull requests, links issues, and manages GitHub-based development.

**When to use:**
- For any GitHub PR or issue linking operation
- When you need to create PRs with proper issue linking
- For standardized GitHub workflows

**Tools required:**
- `shell` (PowerShell for gh CLI commands)

**Model:** GPT-4.1

**User-invocable:** Yes (foundational skill used by higher-level workflows)

**Key features:**
- Create PRs with title and description
- Auto-link issues using `Closes #<IssueNumber>`
- Verify PR/issue linking status
- View PR details
- Enforces English-only PR titles and descriptions
- Validates prerequisites (gh CLI installed, authenticated)

---

## Instructions

### `common-github-context.instructions.md`

**Location:** `templates/common/github/agents/common-github-context.instructions.md`

**Scope:** Global (applies to all files)

**Purpose:** Provides context and setup instructions for GitHub CLI (`gh`) usage, including authentication, available commands, and PR workflow patterns.

**Contents:**
- GitHub CLI setup and authentication
- Available `gh` commands reference
- Pull request workflow steps
- Rules for issue linking and PR creation

---

## Plugin Structure

The `common` plugin consolidates all shared primitives into one discoverable location:

```
plugins/common/
├── plugin.config.yml           # Plugin metadata and configuration
└── .github/plugin/             # Auto-generated (CI only)
    ├── agents/                 # Copied agents
    ├── skills/                 # Copied skills
    └── instructions/           # Copied instructions
```

Generated files (`.github/plugin/plugin.json` and copied assets) are created by the CI workflow after merge to `main`.

## Agent Invocation

Agents are used through the Copilot CLI:

```bash
# List all available agents
copilot list agents

# Use an agent (e.g., for PR creation)
copilot @common-github-pull-request
```

## Adding New Agents

To add new agents to the `common` plugin:

1. Create the agent file in `templates/common/<domain>/agents/<name>.agent.md`
2. Update `plugins/common/plugin.config.yml` to reference the new agent
3. Document the agent in this file under the appropriate section
4. Commit and push — CI will regenerate `plugin.json`

---

## See Also

- [Templates Overview](docs/templates.md)
- [Plugin Configuration](plugins/common/plugin.config.yml)
- [Contributing Guide](CONTRIBUTING.md)
