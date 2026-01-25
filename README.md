# github-copilot-templates

A shared **GitHub Copilot** templates repository with:

- Documentation (concepts, usage, best practices)
- Reusable **Custom Instructions**
- Reusable **Prompt files** (/slash commands)
- **Custom Agents** (specialized roles)

---

## 📖 Documentation

Get started by exploring our comprehensive documentation.

- **[Overview](docs/overview.md)**: Introduction, core concepts, and guiding principles.
- **[JetBrains AI Support](docs/jetbrains-ai.md)**: How to use these templates with JetBrains Junie.
- **[Shared Configuration Sync](docs/sync/shared-config-sync.md)**: How to centralize and sync these templates across repositories.

## 🚀 Quick Start

1. **Explore**: Browse the [**Template List**](docs/template-list.md) to find what you need.
2. **Copy**: Copy relevant `.md` files from the `templates/` folder into your own repository.
3. **Use**:
   - **Instructions**: Place in `.github/copilot-instructions.md` (global) or `.github/instructions/` (scoped).
   - **Prompts**: Place in `.github/prompts/` to use as slash commands (e.g., `/explain-code`).
   - **Agents**: Place in `.github/agents/` to use as specialized roles (e.g., `@security-reviewer`).

## 🛠️ Template Library

This repository contains a wide range of production-ready templates:

- **[Browse All Templates](docs/template-list.md)**: A complete, automatically updated index of all available agents, prompts, and instructions.

| Category | Location | Purpose |
| :--- | :--- | :--- |
| **Instructions** | `templates/instructions/` | Persistent project rules and standards |
| **Prompts** | `templates/prompts/` | Task-specific workflows (Slash commands) |
| **Agents** | `templates/agents/` | Specialized expert roles (@-mentions) |

---

> **Tip**: Instead of manual copying, use our [Sync Scripts](docs/sync/shared-config-sync.md#usage) to keep your repository up-to-date with the latest templates.
