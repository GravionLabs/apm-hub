# Overview

<!-- AUTO:start version -->
Welcome to **apm-hub** v3.2.0 👋
<!-- AUTO:end version -->

apm-hub is a library of reusable **skills** in the [agentskills.io](https://agentskills.io) `SKILL.md` format, distributed as [APM](https://microsoft.github.io/apm/) packages. One skill source loads unchanged on **GitHub Copilot**, **Claude Code** and **OpenCode**. Workflows are skills. The skill `deliver` chains them from issue to merged PR, see [delivery](runner.md).

This documentation is also published as a site at <https://gravionlabs.github.io/apm-hub/>.

## What a package gives you

A package is a domain bundle of skills. Installing it copies the skills into your repository, where the agent picks them up by their `description` or when you name them.

| Package       | What it covers                                                                                                                                         |
| :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared`      | `implementation` (tests per change), `detect-techstack`, `code-review` (blocking findings and notes), `diagnose` (bug diagnosis)                       |
| `delivery`    | `planner`, `retro`, `apm-install`                                                                                                                      |
| `github`      | `github-issue` (Epic → Feature → PBI → Task hierarchy with native sub-issues), `github-pull-request`, `github-release`                                 |
| `dotnet`      | `dotnet-implementation`, `dotnet-test`, `dotnet-create-solution`, `dotnet-mcp-server-generator`                                                        |
| `ts`          | `ts-implementation`, `ts-test`, `ts-create-project`, `ts-mcp-server-generator`, `ts-pnpm-workflow`, `setup-biome-husky`, `setup-prettier-eslint-husky` |
| `py`          | `py-implementation`, `py-test`, `py-create-project`                                                                                                    |
| `rust`        | `rust-implementation`, `rust-test`                                                                                                                     |
| `go`          | `go-implementation`, `go-test`                                                                                                                         |
| `ng`          | `ng-implementation`, `ng-test`, `ng-create-project`, `ng-ag-grid-developer`                                                                            |
| `statusline`  | `context-statusline` skill: status line and subagent status line                                                                                       |
| `core`        | meta-package for the global install: `github`, `delivery`, `shared`, `statusline` (no stack skills)                                                    |
| `apm-tooling` | `skill-write`, `skill-audit`, `skill-slim` (contributor tooling, not in `all`)                                                                         |
| `all`         | every package except `apm-tooling`                                                                                                                     |

The full list with descriptions is generated into [skill-list.md](skill-list.md).

## How the skills fit together

- Every language package has a `<lang>-implementation` skill (conventions plus a `## Review rules` section) and a `<lang>-test` skill.
- `detect-techstack` inspects the project and returns the names of those skills, so `implementation` and `code-review` dispatch to the right language without hard-coded lists.
- You compose the rest in one session: plan with `planner`, implement with `implementation`, review with `code-review`, open the PR with `github-pull-request`.
- `github-issue` is the entry point for issue work. It reads the issue labels and sub-issues and routes to the matching reference workflow.

Skills delegate by name instead of repeating each other. One skill owns a workflow; the others call it.

## Where to go next

- [Quick start and installation](../README.md#-quick-start)
- [Skills](concepts/skills.md): how skills load on each platform and how they are structured
- [Skill frontmatter convention](concepts/skill-frontmatter.md): the restricted frontmatter that keeps skills portable
- [Common workflows](usage/common-workflows.md): end-to-end examples with the installed skills
- [Skill companion directories](usage/skill-companion-dirs.md): `scripts/`, `references/`, `templates/`, `assets/`
- [Working mode](working-mode.md) and [delivery](runner.md): one issue per session, and delivery through `/deliver`
- [Prerequisites](prerequisites.md): tools the skill scripts depend on
- [LSP configuration](lsp-configuration.md): language servers for Copilot CLI
- [CONTRIBUTING.md](../CONTRIBUTING.md) and [AGENTS.md](../AGENTS.md): adding or changing skills

## Guiding principles

- One `SKILL.md` ≤ 100 lines; long material lives in `references/`, procedures in `scripts/`.
- Rules the model does not already know: repo conventions, tool contracts, repeatable procedures. No generic tutorials.
- Compose, don't duplicate.
- The agent proposes, the developer approves.
