# Overview

<!-- AUTO:start version -->
Welcome to **apm-hub** v2.1.1 👋
<!-- AUTO:end version -->

apm-hub is a library of reusable **skills** in the [agentskills.io](https://agentskills.io) `SKILL.md` format, distributed as [APM](https://microsoft.github.io/apm/) packages. One skill source loads unchanged on **GitHub Copilot**, **Claude Code** and **OpenCode**. Workflows are skills. The one `agents` package adds the `orchestrator` primary agent and the `explorer`, `planner`, `reviewer` and `implementer` subagents it delegates to. Entry points beyond skill names are the `/orch` prompt and the `orchestrator` agent.

## What a package gives you

A package is a domain bundle of skills. Installing it copies the skills into your repository, where the agent picks them up by their `description` or when you name them.

| Package                | What it covers                                                                                                                    |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `shared`               | `implementation` (tests per change), `detect-techstack`, `code-review` (severity-rated), `diagnose` (bug diagnosis)               |
| `delivery`             | `orch-pipeline` (`/orch`: plan → TDD → review fan-out → commit), `review-fanout`, `verify-project`, `issue-planning`              |
| `github`               | `github-issue` (Epic → Feature → PBI → Task hierarchy with native sub-issues), `github-pull-request`                              |
| `dotnet`               | `dotnet-implementation`, `dotnet-test`, `dotnet-create-solution`, `dotnet-mcp-server-generator`                                   |
| `ts`                   | `ts-implementation`, `ts-test`, `ts-create-project`, `ts-mcp-server-generator`, `ts-pnpm-workflow`, `setup-prettier-eslint-husky` |
| `py`                   | `py-implementation`, `py-test`, `py-create-project`                                                                               |
| `ng`                   | `ng-implementation`, `ng-test`, `ng-create-project`, `ng-ag-grid-developer`                                                       |
| `agents`               | `orchestrator` (primary agent) plus the `explorer`, `planner`, `reviewer` and `implementer` subagents                              |
| `hooks`                | Claude Code and Copilot CLI hooks (subagent ledger, context warning, git guardrails); OpenCode plugin                              |
| `core`                 | meta-package for the global install: `github`, `delivery`, `shared`, `agents`, `hooks` (no stack skills)                          |
| `apm-tooling`          | `skill-write`, `skill-audit`, `skill-update`, `skill-slim` (contributor tooling, not in `all`)                                    |
| `all`                  | every package except `apm-tooling`                                                                                          |

The full list with descriptions is generated into [skill-list.md](skill-list.md).

## How the skills fit together

- Every language package has a `<lang>-implementation` skill (conventions plus a `## Review rules` section) and a `<lang>-test` skill.
- `detect-techstack` inspects the project and returns the names of those skills, so `implementation`, `code-review` and `verify-project` dispatch to the right language without hard-coded lists.
- `orch-pipeline` composes the rest: it plans tasks, runs test-driven implementation per task, fans out a parallel review and commits after two approval gates.
- `github-issue` is the entry point for issue work. It reads the issue labels and sub-issues and routes to the matching reference workflow.

Skills delegate by name instead of repeating each other. One skill owns a workflow; the others call it.

## Where to go next

- [Quick start and installation](../README.md#-quick-start)
- [Skills](concepts/skills.md): how skills load on each platform and how they are structured
- [Skill frontmatter convention](concepts/skill-frontmatter.md): the restricted frontmatter that keeps skills portable
- [Common workflows](usage/common-workflows.md): end-to-end examples with the installed skills
- [Skill companion directories](usage/skill-companion-dirs.md): `scripts/`, `references/`, `templates/`, `assets/`
- [Prerequisites](prerequisites.md): tools the skill scripts depend on
- [LSP configuration](lsp-configuration.md): language servers for Copilot CLI
- [CONTRIBUTING.md](../CONTRIBUTING.md) and [AGENTS.md](../AGENTS.md): adding or changing skills

## Guiding principles

- One `SKILL.md` ≤ 100 lines; long material lives in `references/`, procedures in `scripts/`.
- Rules the model does not already know: repo conventions, tool contracts, repeatable procedures. No generic tutorials.
- Compose, don't duplicate.
- The agent proposes, the developer approves. Gates in `orch-pipeline` never auto-approve.
