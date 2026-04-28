# copilot-hub

A curated hub for sharing GitHub Copilot instructions, agents, prompts, and CLI plugins — your team's Copilot marketplace.

---

## What is copilot-hub?

**copilot-hub** is a shared library of reusable GitHub Copilot templates — instructions, agents, and prompts — designed to be adopted across projects and teams. 
Templates can be copied individually or installed as **plugins** (bundled, curated sets). 
The hub also hosts **Copilot CLI plugins**, making it a self-service marketplace for Copilot capabilities your team can plug into any repository.

---

## 📖 Documentation

- **[Overview](docs/overview.md)**: Introduction, core concepts, and guiding principles.
- **[JetBrains AI Support](docs/jetbrains-ai.md)**: How to use these templates with JetBrains Junie.
- **[Shared Configuration Sync](docs/sync/copilot-workspace.md)**: Interactive setup wizard and sync script for keeping your repository's Copilot configuration up to date.
- **[Skills](docs/concepts/skills.md)**: What skills are and how they are generated from prompt templates.
- **[Plugins](docs/concepts/plugins.md)**: What plugins are, how to use and create them.

## 🚀 Quick Start

### Using Templates

1. Browse the [**Template List**](docs/template-list.md) to find what you need.
2. Copy the relevant `.md` files from `templates/` into your repository:
   - **[Instructions](templates/instructions/)** → `.github/instructions/`
   - **[Prompts](templates/prompts/)** → `.github/prompts/`
   - **[Agents](templates/agents/)** → `.github/agents/`
   - **[Scripts](scripts/)** → `.github/scripts/`

### 🔄 Sync & Automation

Keep your local configuration up to date using our standalone sync script or the interactive wizard.

#### copilot-sync.ps1

The `copilot-sync.ps1` script is a PowerShell Core script that compares your local `.github/` templates with the latest versions from this hub.

- **[Download copilot-sync.ps1](https://raw.githubusercontent.com/GravionLabs/copilot-hub/main/scripts/copilot-sync.ps1)**
- **Usage**:
  ```powershell
  # Basic sync (prompts for confirmation)
  pwsh .github/scripts/copilot-sync.ps1

  # Autopilot mode (no prompts, good for CI or scheduled tasks)
  pwsh .github/scripts/copilot-sync.ps1 -Autopilot

  # Dry run (show changes without applying)
  pwsh .github/scripts/copilot-sync.ps1 -DryRun

  # Install new templates automatically
  pwsh .github/scripts/copilot-sync.ps1 -InstallNew
  ```

### Installing Plugins via Copilot CLI

**Option A — Register copilot-hub as a custom marketplace** *(recommended)*

```bash
# Register once — then browse and install by name
gh copilot plugin marketplace add GravionLabs/copilot-hub
gh copilot plugin marketplace browse copilot-hub

# Install a specific plugin
gh copilot plugin install csharp-development@copilot-hub
gh copilot plugin install devops@copilot-hub
gh copilot plugin install security@copilot-hub
```

**Option B — Direct install** *(no registration needed)*

```bash
gh copilot plugin install GravionLabs/copilot-hub:plugins/csharp-development
gh copilot plugin install GravionLabs/copilot-hub:plugins/devops
```

**Managing plugins**

```bash
gh copilot plugin list                       # show installed plugins
gh copilot plugin update csharp-development  # update to latest
gh copilot plugin uninstall csharp-development
```

## 🛠️ Template Library

This repository contains a wide range of production-ready templates:

<!-- AUTO:start template-stats -->
| Category         | Count | Location                            | Purpose                                  |
| :--------------- | :---: | :---------------------------------- | :--------------------------------------- |
| **Agents**       |  45   | `templates/<domain>/agents/`        | Specialized expert roles (@-mentions)    |
| **Skills**       |  85   | `templates/<domain>/skills/<name>/` | Reusable task-specific workflows         |
| **Prompts**      |  78   | `templates/<domain>/prompts/`       | Task-specific workflows (slash commands) |
| **Instructions** |  30   | `templates/<domain>/instructions/`  | Persistent project rules and standards   |
<!-- AUTO:end template-stats -->

📄 **[Browse All Templates](docs/template-list.md)**

## 🔌 Plugin Marketplace

Copilot CLI **plugins** are installable bundles of agents, skills (prompts), and instructions scoped to a domain. Each plugin is defined by a `plugin.config.yml` and ships a generated `plugin.json` manifest consumed by the Copilot CLI.

📄 **[Learn about Skills](docs/concepts/skills.md)** · 📄 **[Browse All Skills](docs/skill-list.md)** · 📄 **[Learn about Plugins](docs/concepts/plugins.md)** · 📄 **[Browse All Plugins](docs/plugin-list.md)**

<!-- AUTO:start plugin-table -->
| Plugin                                                               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ag-grid-development`](plugins/ag-grid-development)                 | AG Grid Enterprise development plugin for Angular. Provides expert guidance on AG Grid Enterprise setup, column definitions, row models, filtering, cell rendering/editing, row grouping, pivoting, master-detail, and Excel export. Includes the ag-mcp MCP server setup skill for version-specific doc search inside your IDE.                                                                                                                                                                                                                                                                                             |
| [`angular-development`](plugins/angular-development)                 | Angular 21 full-stack development plugin. Covers standalone components, NgRx Signal Store, Angular libraries, PrimeNG, ESLint/Prettier setup, sakai-ui conventions, and testing with Vitest.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [`copilot-workspace`](plugins/copilot-workspace)                     | Setup and sync GitHub Copilot configuration from GravionLabs/copilot-hub. Provides an interactive wizard (gh-copilot-setup) to bootstrap .github/ with instructions, prompts, and agents tailored to your stack, plus a sync prompt (gh-copilot-sync) to keep them up to date. Includes gh-agents-md to scaffold an AGENTS.md repository context file. Issue workflow skills (gh-issue-implement, gh-issue-finish, gh-issue-work) automate the full branch → implement → review → PR lifecycle. The standalone scripts (copilot-sync.ps1, New-AgentsMd.ps1) are included for manual or scheduled runs without the AI prompt. |
| [`csharp-development`](plugins/csharp-development)                   | C#/.NET full-stack development plugin. Covers project setup, NUnit testing, async/await, code review, XML documentation, design patterns, EF Core, ASP.NET APIs, OpenAPI, MCP servers, .NET upgrades, modernization, Playwright .NET testing, and containerization.                                                                                                                                                                                                                                                                                                                                                          |
| [`devops`](plugins/devops)                                           | Cross-cutting DevOps tooling. Publish code reviews as PR comments to GitHub or Azure DevOps, configure the az CLI azure-devops extension for pipeline integration, and create GitHub Actions CI/CD workflows using GravionLabs/ci reusable workflows.                                                                                                                                                                                                                                                                                                                                                                        |
| [`docker`](plugins/docker)                                           | Docker containerization plugin. Optimized multi-stage Dockerfiles for any language or framework.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [`go-development`](plugins/go-development)                           | Go development plugin for idiomatic Go applications. Covers module structure, error handling, interface design, concurrency patterns, table-driven testing, code review, benchmarking, debugging, and containerization.                                                                                                                                                                                                                                                                                                                                                                                                      |
| [`helm-development`](plugins/helm-development)                       | Helm chart development plugin for Kubernetes packaging. Covers chart structure, values.yaml design, named templates, security contexts, OCI distribution, Helmfile, and chart upgrades.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [`playwright`](plugins/playwright)                                   | Cross-language Playwright testing plugin. Browser automation, form filling, test generation, and website exploration. Language-specific instructions (playwright-dotnet, playwright-python, playwright-typescript) are bundled with the respective language plugins (csharp-development, python-development, typescript-node-development).                                                                                                                                                                                                                                                                                   |
| [`postgresql`](plugins/postgresql)                                   | PostgreSQL development and administration plugin. Schema design, query optimization, performance diagnostics, code review, Row Level Security, JSONB, and SQL best practices.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [`python-development`](plugins/python-development)                   | Python development plugin. Covers project setup with uv, pytest testing with fixtures and markers, type hints, code review, Playwright Python testing, and containerization.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [`security`](plugins/security)                                       | Security and resilience tooling. STRIDE threat modeling, security compliance review. Tech-stack agnostic – usable alongside any language plugin.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [`terraform-development`](plugins/terraform-development)             | Terraform infrastructure-as-code development plugin. Covers module design, naming conventions, state management, security best practices, code review, and multi-cloud provider configurations.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [`typescript-node-development`](plugins/typescript-node-development) | TypeScript and Node.js development plugin. Covers strict typing, ESM modules, async/await patterns, error handling, code review, debugging, Playwright TypeScript testing, and containerization.                                                                                                                                                                                                                                                                                                                                                                                                                             |
<!-- AUTO:end plugin-table -->

Plugins live in the `plugins/` folder. The template counts and plugin table above are **auto-generated** on every change.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a template or plugin.

---

> **Tip**: Instead of manual copying, install the [`copilot-workspace`](docs/sync/copilot-workspace.md) plugin and run `/gh-copilot-setup` to get started, then `/gh-copilot-sync` to keep templates up to date.
