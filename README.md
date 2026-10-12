# apm-hub

A curated hub of cross-platform **agent skills** — distributed as APM packages, usable with GitHub Copilot, Claude Code, and OpenCode.

---

## What is apm-hub?

**apm-hub** is a shared library of reusable **skills** ([agentskills.io](https://agentskills.io) format), distributed as **APM packages** via [Agent Package Manager](https://microsoft.github.io/apm/). Each package is a curated, domain-specific bundle of skills that you can install into any repository with a single command. There are no agents: workflows are skills, and the `/orch` prompt is the only extra entry point.

Skills are the primary artifact: one `SKILL.md` source file loads unchanged on GitHub Copilot, Claude Code, and OpenCode. See the [skill frontmatter convention](docs/concepts/skill-frontmatter.md) for how that is guaranteed.

---

## 📖 Documentation

- **[Overview](docs/overview.md)**: Introduction, core concepts, and guiding principles.
- **[Skills](docs/concepts/skills.md)**: What skills are and how they work across platforms.
- **[Skill Frontmatter Convention](docs/concepts/skill-frontmatter.md)**: The spec-compliant frontmatter every skill follows.
- **[Prerequisites](docs/prerequisites.md)**: System requirements and setup guide for apm-hub skills.
- **[Common Workflows](docs/usage/common-workflows.md)**: End-to-end examples with the installed skills.
- **[Skill Companion Directories](docs/usage/skill-companion-dirs.md)**: `scripts/`, `references/`, `templates/`, `assets/`.
- **[LSP Configuration](docs/lsp-configuration.md)**: Enable precise code intelligence with Language Server Protocol.

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

3. Install individual packages:
   ```bash
   apm install ng@apm-hub
   apm install ts@apm-hub
   apm install dotnet@apm-hub
   ```

   Globally, install the workflow skills and agents without any stack skills:
   ```bash
   apm install GravionLabs/apm-hub/packages/core -g
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

| Package                | Contents                                                                                                                          |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `shared`               | `implementation`, `detect-techstack`, `code-review`                                                                               |
| `development-workflow` | `orch-pipeline` (`/orch`), `review-fanout`, `verify-project`, `issue-planning`                                                    |
| `github`               | `github-issue`, `github-pull-request`                                                                                             |
| `dotnet`               | `dotnet-implementation`, `dotnet-test`, `dotnet-create-solution`, `dotnet-mcp-server-generator`; depends on `dotnet/skills` (`plugins/dotnet`) |
| `ts`                   | `ts-implementation`, `ts-test`, `ts-create-project`, `ts-mcp-server-generator`, `ts-pnpm-workflow`, `setup-prettier-eslint-husky` |
| `py`                   | `py-implementation`, `py-test`, `py-create-project`                                                                               |
| `ng`                   | `ng-implementation`, `ng-test`, `ng-create-project`, `ng-ag-grid-developer`; depends on `angular/skills` (`angular-developer`)    |
| `agents`               | `orchestrator`, `explorer`, `reviewer`, `implementer` (subagents) — see below                                                     |
| `apm-tooling`          | `skill-write`, `skill-audit`, `skill-update`, `skill-slim` (contributor tooling)                                                  |
| `all`                  | every package above except `apm-tooling`                                                                                          |

📄 **[Learn about Skills](docs/concepts/skills.md)** · 📄 **[Browse All Skills](docs/skill-list.md)** · 📄 **[Browse All Agents](docs/agent-list.md)** · 📄 **[Working mode](docs/working-mode.md)** (small contexts, one issue per session) · 📄 **[External frameworks](docs/frameworks.md)** · 📄 **[AGENTS.md](AGENTS.md)** for layout and conventions

## 🤖 Agents

Skills are the primary artifact; the `agents` package adds the four agents skills cannot replace.
`orchestrator` runs as the **primary agent** and keeps only phase summaries in its context; the
three subagents each have their own model and tool set:

| Agent          | Role                                                                                                                  |            |                                                                                                |
| :------------- | :-------------------------------------------------------------------------------------------------------------------- | :--------- | :--------------------------------------------------------------------------------------------- |
| `orchestrator` | `plan\                                                                                                                | implement\ | full <issue>`: explore → plan → implement per task → review → PR; approval gates stay with you |
| `explorer`     | read-only, small model, ≤ 300-word answers with `path:line` references                                                |            |                                                                                                |
| `reviewer`     | read-only plus the test command, returns the `review-fanout` findings JSON                                            |            |                                                                                                |
| `implementer`  | one task per run (sonnet by default), `implementation` skill preloaded, commits, report file + ≤ 15-line status reply |            |                                                                                                |

```powershell
apm install GravionLabs/apm-hub/packages/core -g   # deploys the agents to ~/.claude/agents, ~/.copilot/agents, ~/.config/opencode/agents
apmw sanitize -g -p claude; apmw sanitize -g -p opencode; apmw sanitize -g -p copilot   # per-platform frontmatter (required for OpenCode)
claude --agent orchestrator "full 123"     # Copilot: copilot --agent orchestrator · OpenCode: opencode --agent orchestrator
```

Source format and the `metadata` block: [docs/concepts/agent-frontmatter.md](docs/concepts/agent-frontmatter.md).
[`apmw`](https://github.com/GravionLabs/apmw) does the per-platform rewrite.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a skill or package.

```bash
pnpm install
pnpm run build && pnpm test            # generators + skill size check
node scripts/check-manifests.mjs --fix # sync apm.yml skills lists
```

New or changed skills must follow the [skill frontmatter convention](docs/concepts/skill-frontmatter.md).

---

> **Tip**: Add individual packages to your project's `apm.yml` and run `apm install` to get started.
