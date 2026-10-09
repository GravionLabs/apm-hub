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

#### `github-issue`

**Location:** `packages/github/.apm/skills/github-issue/SKILL.md`

**Purpose:** Routing skill for the GitHub issue lifecycle (Epic→Feature→PBI→Task, Bug→Task). Reads the issue type from labels and whether it has native sub-issues, then follows the matching reference under `references/`.

**When to use:** Any GitHub issue work, single issues or batches.

---

## Development Workflow Package (`packages/development-workflow`)

| Skill            | Description                                                                                         |
|:-----------------|:----------------------------------------------------------------------------------------------------|
| `orch-pipeline`  | Plan → TDD per task → review fan-out → commit, with two approval gates. Invoked via `/orch`.        |
| `review-fanout`  | Parallel multi-dimension diff review with adversarial verification. Returns APPROVE / CHANGES_REQUESTED. |
| `issue-planning` | Breaks an issue into sub-tasks and creates native GitHub sub-issues. Emits a plan JSON.             |
| `verify-project` | Runs build, tests and lint; reports pass/fail with the first error.                                 |
| `cliff-setup`    | Sets up git-cliff changelog generation.                                                             |

---


## Shared & Language Packages

| Package | Skill | Description |
|:--------|:------|:------------|
| `shared` | `code-review` | Severity-rated review; loads each detected language's `## Review rules` from its `<lang>-implementation` skill. |
| `shared` | `implementation` | Language-agnostic rules: every change includes tests; dispatches to `<lang>-implementation`. |
| `shared` | `detect-techstack` | Detects languages, package manager, and the matching `<lang>-test` / `<lang>-implementation` skills. |
| `ng` | `ng-signal-store` | Scaffolds an NgRx Signal Store (`@ngrx/signals`) for feature state. |
| `ng` | `ng-library` | Scaffolds an Angular library with `public-api.ts` as the single export surface. |
| `ng` | `ng-component` | Scaffolds a standalone OnPush component (3-file structure; Sakai UI variant). |

Each language package (`dotnet`, `py`, `ts`, `ng`) provides `<lang>-implementation` (conventions + review rules) and `<lang>-test`.

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
| `skill-update` | Applies targeted fixes to an existing SKILL.md. |
| `skill-slim` | Measures and slims skills across a package: classifies content (keep / delete / move / deduplicate), reports findings, applies approved changes. |
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
github-issue <issue-number>
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
