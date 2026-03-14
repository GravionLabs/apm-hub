# copilot-hub

A curated hub for sharing GitHub Copilot instructions, agents, prompts, collections, and CLI plugins — your team's Copilot marketplace.

---

## What is copilot-hub?

**copilot-hub** is a shared library of reusable GitHub Copilot templates — instructions, agents, and prompts — designed to be adopted across projects and teams. Templates can be copied individually or installed as **plugins** (bundled, curated sets). The hub also hosts **Copilot CLI plugins**, making it a self-service marketplace for Copilot capabilities your team can plug into any repository.

---

## 📖 Documentation

- **[Overview](docs/overview.md)**: Introduction, core concepts, and guiding principles.
- **[JetBrains AI Support](docs/jetbrains-ai.md)**: How to use these templates with JetBrains Junie.
- **[Shared Configuration Sync](docs/sync/shared-config-sync.md)**: How to centralize and sync templates across repositories.
- **[Plugins](docs/concepts/plugins.md)**: What plugins are, how to use and create them.

## 🚀 Quick Start

### Using Templates

1. Browse the [**Template List**](docs/template-list.md) to find what you need.
2. Copy the relevant `.md` files from `templates/` into your repository:
   - **Instructions** → `.github/instructions/`
   - **Prompts** → `.github/prompts/`
   - **Agents** → `.github/agents/`

### Using a Plugin

Install a plugin via the Copilot CLI and reference its `plugin.config.yml`. See the [Plugin Marketplace](#-plugin-marketplace) section below for available plugins.

## 🛠️ Template Library

This repository contains a wide range of production-ready templates:

| Category | Count | Location | Purpose |
| :--- | :---: | :--- | :--- |
| **Agents** | 26 | `templates/agents/` | Specialized expert roles (@-mentions) |
| **Prompts** | 40 | `templates/prompts/` | Task-specific workflows (slash commands) |
| **Instructions** | 40 | `templates/instructions/` | Persistent project rules and standards |

📄 **[Browse All Templates](docs/template-list.md)**

## 🔌 Plugin Marketplace

Copilot CLI **plugins** are installable bundles of agents, skills (prompts), and instructions scoped to a domain. Each plugin is defined by a `plugin.config.yml` and ships a generated `plugin.json` manifest consumed by the Copilot CLI.

📄 **[Learn about Plugins](docs/concepts/plugins.md)**

| Plugin | Description |
| :--- | :--- |
| `gfog-security` | Security & resilience: STRIDE threat modeling, RWEST SSDLC, Disaster Recovery |
| `gfog-csharp-development` | C# .NET development: tests, code review, Helm, async patterns |
| `gfog-devops` | DevOps: Azure DevOps pipelines, PR automation, code review publishing |

Plugins live in the `plugins/` folder. Each plugin contains a `plugin.config.yml` describing its agents, skills, and instructions.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a template or plugin.

---

> **Tip**: Instead of manual copying, use our [Sync Scripts](docs/sync/shared-config-sync.md#usage) to keep your repository up-to-date with the latest templates automatically.
