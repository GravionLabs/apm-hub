# copilot-hub

A curated hub for sharing GitHub Copilot instructions, agents, prompts, and CLI plugins — your team's Copilot marketplace.

---

## What is copilot-hub?

**copilot-hub** is a shared library of reusable GitHub Copilot templates — instructions, agents, and prompts — designed to be adopted across projects and teams. Templates can be copied individually or installed as **plugins** (bundled, curated sets). The hub also hosts **Copilot CLI plugins**, making it a self-service marketplace for Copilot capabilities your team can plug into any repository.

---

## 📖 Documentation

- **[Overview](docs/overview.md)**: Introduction, core concepts, and guiding principles.
- **[JetBrains AI Support](docs/jetbrains-ai.md)**: How to use these templates with JetBrains Junie.
- **[Shared Configuration Sync](docs/sync/copilot-workspace.md)**: Interactive setup wizard and sync script for keeping your repository's Copilot configuration up to date.
- **[Plugins](docs/concepts/plugins.md)**: What plugins are, how to use and create them.

## 🚀 Quick Start

### Using Templates

1. Browse the [**Template List**](docs/template-list.md) to find what you need.
2. Copy the relevant `.md` files from `templates/` into your repository:
   - **Instructions** → `.github/instructions/`
   - **Prompts** → `.github/prompts/`
   - **Agents** → `.github/agents/`

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
| Category         | Count | Location                  | Purpose                                  |
| :--------------- | :---: | :------------------------ | :--------------------------------------- |
| **Agents**       |  26   | `templates/agents/`       | Specialized expert roles (@-mentions)    |
| **Prompts**      |  38   | `templates/prompts/`      | Task-specific workflows (slash commands) |
| **Instructions** |  20   | `templates/instructions/` | Persistent project rules and standards   |
<!-- AUTO:end template-stats -->

📄 **[Browse All Templates](docs/template-list.md)**

## 🔌 Plugin Marketplace

Copilot CLI **plugins** are installable bundles of agents, skills (prompts), and instructions scoped to a domain. Each plugin is defined by a `plugin.config.yml` and ships a generated `plugin.json` manifest consumed by the Copilot CLI.

📄 **[Learn about Plugins](docs/concepts/plugins.md)** · 📄 **[Browse All Plugins](docs/plugin-list.md)**

<!-- AUTO:start plugin-table -->
| Plugin                                             | Description                                                                                                                                                                                                                                                                                                                                                                           |
| :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`copilot-workspace`](plugins/copilot-workspace)   | Setup and sync GitHub Copilot configuration from GravionLabs/copilot-hub. Provides an interactive wizard (gh-copilot-setup) to bootstrap .github/ with instructions, prompts, and agents tailored to your stack, plus a sync prompt (gh-copilot-sync) to keep them up to date. The standalone copilot-sync.ps1 script is included for manual or scheduled runs without the AI prompt. |
| [`csharp-development`](plugins/csharp-development) | C#/.NET full-stack development plugin. Covers project setup, NUnit testing, async/await, code review, XML documentation, design patterns, EF Core, ASP.NET APIs, OpenAPI, MCP servers, .NET upgrades, modernization, Playwright .NET testing, and containerization.                                                                                                                   |
| [`devops`](plugins/devops)                         | Cross-cutting DevOps tooling. Publish code reviews as PR comments to GitHub or Azure DevOps, configure the az CLI azure-devops extension for pipeline integration, and create GitHub Actions CI/CD workflows using GravionLabs/ci reusable workflows.                                                                                                                                 |
| [`security`](plugins/security)                     | Security and resilience tooling. STRIDE threat modeling, security compliance review. Tech-stack agnostic – usable alongside any language plugin.                                                                                                                                                                                                                                      |
<!-- AUTO:end plugin-table -->

Plugins live in the `plugins/` folder. The template counts and plugin table above are **auto-generated** on every change.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a template or plugin.

---

> **Tip**: Instead of manual copying, install the [`copilot-workspace`](docs/sync/copilot-workspace.md) plugin and run `/gh-copilot-setup` to get started, then `/gh-copilot-sync` to keep templates up to date.
