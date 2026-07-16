# Agents Overview

This document describes the agents and skills available through apm-hub APM packages. Agents are specialized roles that handle specific workflows and can be used via Copilot (via @-mentions or slash commands).

## GitHub Package (`packages/github`)

### Git & GitHub Workflow

#### `github-pull-request`

**Location:** `packages/github/.apm/skills/github-pull-request/SKILL.md`

**Purpose:** Creates a GitHub Pull Request for the current branch, generates a proper title (derived from commit types and the issue number), builds a structured markdown description, and auto-links the GitHub issue.

**When to use:**
- After committing and pushing a branch to GitHub
- When you need to create a PR and automatically link a GitHub issue
- For standardized PR workflows with proper issue linking

**Tools required:**
- `shell` (gh CLI)

**Key features:**
- Gathers context in parallel: current branch, git log, diff stat, and issue details
- Generates standardized PR titles: `<type>: <description> (#<issue_number>)`
- Builds structured Markdown PR descriptions with Summary, Changes, and Testing sections
- Auto-links issues using `Closes #<issue_number>` (auto-closes issue when merged)
- Verifies branch is pushed before creating PR

---



#### `github-workflow`

**Location:** `packages/github/.apm/skills/github-workflow/SKILL.md`
(also available at `.github/skills/github-workflow/SKILL.md`)

**Purpose:** Manages GitHub workflows using the `gh` CLI or GH MCP — creates pull requests, links issues, and manages GitHub-based development. Caller provides PR title, description, and issue number.

**When to use:**
- For any GitHub PR or issue linking operation
- When you need to create PRs with proper issue linking
- For standardized GitHub workflows

**Tools required:**
- `shell` (PowerShell / gh CLI), `mcp_github_create_pull_request`, `mcp_github_list_pull_requests`

**Model:** GPT-4.1

**User-invocable:** Yes (foundational skill used by higher-level workflows)

**Key features:**
- Create PRs with title and description (MCP primary, gh CLI fallback)
- Auto-link issues using `Closes #<IssueNumber>`
- Verify PR/issue linking status
- View PR details
- Enforces English-only PR titles and descriptions
- Validates prerequisites (gh CLI installed, authenticated)

---

### Issue-to-PR Lifecycle Skills

#### `github-issue-start`

**Location:** `packages/github/.apm/skills/github-issue-start/SKILL.md`
(also at `.github/skills/github-issue-start/SKILL.md`)

**Purpose:** Reads a GitHub issue, creates the appropriate branch, and fully implements it through four phases: Prepare → Plan → Implement → Verify.

**When to use:** To start work on a new GitHub issue — reads issue, creates branch, writes code, tests, and docs, and pushes.

**Model:** claude-sonnet-4.6

**Key features:**
- Reads issue via GH MCP (`mcp_github_get_issue`) or `gh issue view` fallback
- Branch naming: `<type>/<issue-number>-<slug>` where type is `feature/`, `bugfix/`, `hotfix/`, or `chore/`
- Atomic commits: `<type>: <description> (#<issue-number>)`
- Structured output with ✅ Summary, 📝 What Changed, ✔️ Verify, and 🚀 Next Steps

---

#### `github-issue-finish`

**Location:** `packages/github/.apm/skills/github-issue-finish/SKILL.md`
(also at `.github/skills/github-issue-finish/SKILL.md`)

**Purpose:** Reviews the implementation and opens a pull request. Run after `github-issue-start` when implementation is complete.

**When to use:** After `github-issue-start` completes — verifies build/tests pass, creates PR via the `github-pull-request` skill or MCP, confirms CI is running.

**Model:** claude-sonnet-4.6

**Key features:**
- Runs full build and test suite before creating PR
- Delegates PR creation to the `github-pull-request` skill (preferred) or MCP
- PR title format: `<type>: <description> (#<issue-number>)` with parentheses
- Verifies CI checks are running after PR is created

---

#### `github-issue-workflow`

**Location:** `packages/github/.apm/skills/github-issue-workflow/SKILL.md`
(also at `.github/skills/github-issue-workflow/SKILL.md`)

**Purpose:** End-to-end workflow for a GitHub issue: reads issue, creates branch, implements with tests and docs, reviews, and opens a pull request. Combines `github-issue-start` and `github-issue-finish` in one command.

**When to use:** For straightforward issues where you want the full lifecycle in one step. For complex issues, run `github-issue-start` and `github-issue-finish` separately.

**Model:** claude-sonnet-4.6

---

## Repo Tooling Skills (`.github/skills/`)

These skills support development workflows within apm-hub itself and are committed directly to `.github/skills/`.

### Agent Lifecycle

| Skill          | Description                                                                                     |
|:---------------|:------------------------------------------------------------------------------------------------|
| `agent-create` | Creates a new `.agent.md` file; validates name, target platform, and role. Calls `agent-write`. |
| `agent-write`  | Drafts and validates agent content; enforces PowerShell syntax for all shell code blocks.       |
| `agent-update` | Applies targeted fixes to an existing agent file.                                               |
| `agent-audit`  | Audits an `.agent.md` for correctness; emits a JSON report; optionally calls `agent-update`.    |

**Placement rules:**
- VS Code / Copilot CLI → `.github/agents/` (project) or `~/.copilot/agents/` (global)
- Claude Code → `.claude/agents/` (project) or `~/.claude/agents/` (global)
- APM package → `packages/<domain>/.apm/agents/`

### Skill Lifecycle

| Skill          | Description                                                                                      |
|:---------------|:-------------------------------------------------------------------------------------------------|
| `skill-create` | Creates a new skill directory with `SKILL.md`; validates name and location. Calls `skill-write`. |
| `skill-write`  | Drafts and validates SKILL.md content; enforces PowerShell syntax for all shell code.            |
| `skill-update` | Applies targeted fixes to an existing SKILL.md.                                                  |
| `skill-audit`  | Audits a SKILL.md for correctness; emits a JSON report; optionally calls `skill-update`.         |

**Placement rules:**
- Domain workflows → `packages/<domain>/.apm/skills/<name>/`
- Repo-level tooling → `.github/skills/<name>/` (only for apm-hub contributor tools)
- APM package → `packages/apm-tooling/.apm/skills/<name>/`

### Environment

| Skill                 | Description                                                                                                                                                            |
|:----------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `check-prerequisites` | Verifies all required tools are installed (PowerShell 7+, Git, Node.js, npm). Supports `-Full` (adds `gh`, `jq`, `yq`, `ast-grep`, Python 3) and `-AutoInstall` flags. |

```powershell
# Quick check
pwsh .github/skills/check-prerequisites/scripts/Check-Prerequisites.ps1

# Full check with auto-install
pwsh .github/skills/check-prerequisites/scripts/Check-Prerequisites.ps1 -Full -AutoInstall
```

---

### apm-tooling Package

**Location:** `packages/apm-tooling/`

**Purpose:** APM contributor tooling for managing skill lifecycle. Install via `apm install apm-tooling@apm-hub`.

| Skill | Description |
|:------|:------------|
| `skill-audit` | Audits a SKILL.md for correctness; emits a JSON report; optionally calls `skill-update`. |
| `skill-create` | Creates a new skill directory with SKILL.md; validates name and location. Calls `skill-write`. |
| `skill-update` | Applies targeted fixes to an existing SKILL.md. |
| `skill-write` | Drafts and validates SKILL.md content; enforces PowerShell syntax for all shell code. |

---

## Instructions


---

## APM Package Structure

Packages live under `packages/<domain>/` and contain an `.apm/` directory with agents, skills, and instructions:

```
packages/<domain>/
├── apm.yml                    # Package metadata and dependencies
└── .apm/
    ├── agents/                # *.agent.md files
    ├── skills/<name>/         # SKILL.md per skill
    └── instructions/          # *.instructions.md files
```

The `apm.yml` at the repo root lists all marketplace packages. `apm_modules/` is where packages are installed locally (gitignored).

Generated installation artifacts (`.github/`, `.claude/`, `.cursor/`, `.opencode/`, `.gemini/`) are created by `apm install` and committed to consuming repos — not to apm-hub itself.

---

## Agent Invocation

Install packages into a project with APM:

```bash
# Install individual packages
apm install github@apm-hub
# Install all packages
apm install all@apm-hub
```

Use agents via editor integration (VS Code, JetBrains) or Copilot CLI after installation:

```bash
# Use the PR creation agent
@github-pull-request <issue-number>

# Run a skill explicitly
github-issue-start <issue-number>
github-issue-finish <issue-number>
```

---

## Adding New Agents

To add a new agent to a package:

1. Use skill `agent-create` to scaffold the agent file in `packages/<domain>/.apm/agents/<name>.agent.md`
2. Update `packages/<domain>/apm.yml` to reference the new agent if needed
3. Add platform-specific frontmatter in a `metadata:` block (see below)
4. Run `node scripts/check-agent-targets.mjs --fix` to regenerate the compiled targets
5. Document the agent in this file under the appropriate section
6. Commit and push — consumers run `apm install` to pick up the update

### Multi-target agent frontmatter

Source files are written in **GitHub Copilot style** (primary format). Platform-specific fields go in a `metadata:` block. `apmw` and the apm-hub generator extract each platform's block and inject it into the compiled output; `metadata:` itself is always stripped from all outputs.

```yaml
---
name: my-agent
description: "What this agent does."
# Copilot-native fields (kept in .github/agents output)
mode: all
steps: 40
color: primary
tools: ['agent', 'read', 'search']
user-invocable: true
# Platform-specific overrides
metadata:
  opencode:
    permission:
      read: allow
      edit: deny
      glob: allow
      grep: allow
      bash:
        "*": deny
      task: allow
      skill: allow
      webfetch: allow
      question: allow
  claude:
    tools:
      - Bash
      - Read
      - Glob
      - Grep
      - WebFetch
      - Task
---

Agent body — identical on all platforms.
```

**Rules:**
- Top-level fields are Copilot defaults; only add what Copilot understands at the top level.
- `permission:` (OpenCode) and Claude-native `tools:` belong under `metadata.<platform>`.
- `metadata` wins on conflict — if both the top level and `metadata.opencode` define `permission:`, the metadata version is used in the OpenCode output.
- After editing source agents, always run `node scripts/check-agent-targets.mjs --fix` then commit the regenerated files in `.github/agents/`, `.opencode/agents/`, and `.claude/agents/`.

See [docs/concepts/agents.md — Multi-target Agents](docs/concepts/agents.md#9-multi-target-agents--writing-for-multiple-platforms) for the full field compatibility table, platform-specific field references, and compilation pipeline details.

---

## See Also

- [Skills Overview](docs/concepts/skills.md)
- [Agent Concepts](docs/concepts/agents.md)
- [Package Format](docs/PACKAGE_FORMAT.md)
- [APM Package Configuration](apm.yml)
- [Contributing Guide](CONTRIBUTING.md)
