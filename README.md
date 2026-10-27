# apm-hub

A curated hub of cross-platform **agent skills** — distributed as APM packages, usable with GitHub Copilot, Claude Code, and OpenCode.

Documentation site: **[gravionlabs.github.io/apm-hub](https://gravionlabs.github.io/apm-hub/)**

---

## What is apm-hub?

**apm-hub** is a shared library of reusable **skills** ([agentskills.io](https://agentskills.io) format), distributed as **APM packages** via [Agent Package Manager](https://microsoft.github.io/apm/). Each package is a curated, domain-specific bundle of skills that you can install into any repository with a single command. Workflows are skills; the runner that chains them lives in [dromos](docs/runner.md).

Skills are the primary artifact: one `SKILL.md` source file loads unchanged on GitHub Copilot, Claude Code, and OpenCode. See the [skill frontmatter convention](docs/concepts/skill-frontmatter.md) for how that is guaranteed.

---

## 📖 Documentation

- **[Overview](docs/overview.md)**: Introduction, core concepts, and guiding principles.
- **[Skills](docs/concepts/skills.md)**: What skills are and how they work across platforms.
- **[Skill Frontmatter Convention](docs/concepts/skill-frontmatter.md)**: The spec-compliant frontmatter every skill follows.
- **[Working mode](docs/working-mode.md)**: one issue per session, small contexts.
- **[The runner](docs/runner.md)**: the automated pipeline lives in dromos.
- **[Simplification plan](docs/simplification-plan.md)**: why apm-hub becomes a content-only repository and the pipeline moves to dromos.
- **[Simplification work plan](docs/simplification-workplan.md)**: order of work, PBIs and milestones for that change.
- **[Prerequisites](docs/prerequisites.md)**: System requirements and setup guide for apm-hub skills.
- **[Common Workflows](docs/usage/common-workflows.md)**: End-to-end examples with the installed skills.
- **[Skill Companion Directories](docs/usage/skill-companion-dirs.md)**: `scripts/`, `references/`, `templates/`, `assets/`.
- **[Copilot CLI hooks](docs/usage/copilot-hooks.md)**: manual setup, upgrade cleanup.
- **[Format override](docs/usage/format-override.md)**: replace the format and check commands per language with `.agents/format.json`.
- **Project standard** (`github-project`): ships from [GravionLabs/ci](https://github.com/GravionLabs/ci) (`apm install GravionLabs/ci`), see its `docs/project-standard.md`.
- **[LSP Configuration](docs/lsp-configuration.md)**: Enable precise code intelligence with Language Server Protocol.

## Upgrading from 2.x

3.0.0 is content-only: the agents and the orchestration skills (`orchestrator`, `review-fanout`, `verify-project`, `queue`, `handoff`, `orch-pipeline`, `orch`) and the agents (`orchestrator`, `pbi-runner`, `implementer`, `issue-reader`, `explorer`, `planner`, `pr-writer`, `review-lead`, `reviewer`) are gone; the runner is [dromos](docs/runner.md). If you still want the old pipeline, pin `agents`, `github` and `delivery` together at `#v2.5.4`; otherwise remove the `agents` entry and run `apm update -g`. What apm cleans itself and what can remain: [after install](packages/delivery/.apm/skills/apm-install/references/after-install.md).

## 🚀 Quick Start

### Prerequisites

Before using apm-hub skills, verify that your system has all required prerequisites:

```powershell
pwsh .github/skills/check-prerequisites/scripts/Check-Prerequisites.ps1
```

See **[Prerequisites Documentation](docs/prerequisites.md)** for detailed setup instructions for your platform.

### Installing packages with APM

1. Install the APM CLI:
   ```bash
   curl -sSL https://aka.ms/apm-unix | sh   # macOS / Linux
   # or: winget install Microsoft.APM
   ```

2. Register the apm-hub marketplace (once per machine):
   ```bash
   apm marketplace add GravionLabs/apm-hub
   ```

   Or let the `/apm-install` skill detect your stack and install the matching packages.

3. Install individual packages:
   ```bash
   apm install ng@apm-hub
   apm install ts@apm-hub
   apm install dotnet@apm-hub
   ```

   Globally, install the workflow skills without any stack skills:
   ```bash
   apm install -g GravionLabs/apm-hub/packages/core
   ```

   Or install **all packages** at once (machines that mix stacks):
   ```bash
   apm install all@apm-hub
   ```

4. Or add packages directly to your project's `apm.yml`:
   ```yaml
   name: my-project
   version: 1.0.0
   dependencies:
     apm:
       - GravionLabs/apm-hub/packages/ng
       - GravionLabs/apm-hub/packages/ts
   ```
   Then run `apm install` to deploy to `.github/`, `.claude/`, `.cursor/` etc.

### Where things land

| Platform       | Skills                     |
| :------------- | :------------------------- |
| GitHub Copilot | `.github/skills/<name>/`   |
| Claude Code    | `.claude/skills/<name>/`   |
| OpenCode       | `.opencode/skills/<name>/` |

### What to commit in your project

| Path                                                      | Action                              |
| :-------------------------------------------------------- | :---------------------------------- |
| `apm.yml`                                                 | ✅ Commit                            |
| `apm.lock.yaml`                                           | ✅ Commit                            |
| `.github/skills/`, `.claude/skills/`, `.opencode/skills/` | ✅ Commit (instant context on clone) |
| `apm_modules/`                                            | ❌ Add to `.gitignore`               |

### Requirements

Skill scripts are PowerShell 7+ (`pwsh`) and run on Windows, macOS and Linux. `detect-techstack`, which most workflow skills call first, has a manual fallback when `pwsh` is missing, but installing it is strongly recommended.

## 📦 APM Packages

apm-hub distributes domain packages via APM. Each package is installed with `apm install` and deployed to `.github/`, `.claude/`, `.cursor/`, `.opencode/`, and `.gemini/` automatically.

| Package       | Contents                                                                                                                                       |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared`      | `implementation`, `detect-techstack`, `diagnose`, `code-review`                                                                                |
| `delivery`    | `issue-planning`, `retro`, `apm-install`                                                                                                       |
| `github`      | `github-issue`, `github-pull-request`, `github-release`                                                                                        |
| `dotnet`      | `dotnet-implementation`, `dotnet-test`, `dotnet-create-solution`, `dotnet-mcp-server-generator`; depends on `dotnet/skills` (`plugins/dotnet`) |
| `ts`          | `ts-implementation`, `ts-test`, `ts-create-project`, `ts-mcp-server-generator`, `ts-pnpm-workflow`, `setup-prettier-eslint-husky`              |
| `py`          | `py-implementation`, `py-test`, `py-create-project`                                                                                            |
| `rust`        | `rust-implementation`, `rust-test`                                                                                                             |
| `ng`          | `ng-implementation`, `ng-test`, `ng-create-project`, `ng-ag-grid-developer`; depends on `angular/skills` (`angular-developer`)                 |
| `hooks`       | Claude Code git guardrails hook (denies destructive git commands)                                                                              |
| `statusline`  | `context-statusline` skill: status line and subagent status line                                                                               |
| `core`        | meta-package for the global install: `github`, `delivery`, `shared`, `hooks`, `statusline` (no stack skills)                                   |
| `apm-tooling` | `skill-write`, `skill-audit`, `skill-update`, `skill-slim` (contributor tooling)                                                               |
| `all`         | every package above except `apm-tooling`                                                                                                       |

📄 **[Learn about Skills](docs/concepts/skills.md)** · 📄 **[Browse All Skills](docs/skill-list.md)** · 📄 **[Working mode](docs/working-mode.md)** (small contexts, one issue per session) · 📄 **[External frameworks](docs/frameworks.md)** · 📄 **[AGENTS.md](AGENTS.md)** for layout and conventions

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a skill or package.

```bash
pnpm install
pnpm run build && pnpm test            # generators + skill size check
node scripts/check-manifests.mjs --fix # sync apm.yml x-skills lists
```

New or changed skills must follow the [skill frontmatter convention](docs/concepts/skill-frontmatter.md).

---

> **Tip**: Add individual packages to your project's `apm.yml` and run `apm install` to get started.
