# apm-hub

A curated hub for sharing GitHub Copilot instructions, agents, prompts, and APM packages — your team's Copilot marketplace.

---

## What is apm-hub?

**apm-hub** is a shared library of reusable GitHub Copilot templates — instructions, agents, and prompts — distributed as **APM packages** via [Agent Package Manager](https://microsoft.github.io/apm/). Each package is a curated, domain-specific bundle of agents, skills, and instructions you can install into any repository with a single command.

---

## 📖 Documentation

- **[Overview](docs/overview.md)**: Introduction, core concepts, and guiding principles.
- **[JetBrains AI Support](docs/jetbrains-ai.md)**: How to use these templates with JetBrains Junie.
- **[Skills](docs/concepts/skills.md)**: What skills are and how they are generated from prompt templates.

## 🚀 Quick Start

### Installing packages with APM

1. Install the APM CLI:
   ```bash
   curl -sSL https://aka.ms/apm-unix | sh   # macOS / Linux
   # or: winget install Microsoft.APM
   ```

2. Create an `apm.yml` in your repository:
   ```yaml
   name: my-project
   version: 1.0.0
   dependencies:
     apm:
       - gravion/apm-hub/packages/angular#v1.2.3
       - gravion/apm-hub/packages/common#v1.2.3
   ```

3. Install and deploy to `.github/`:
   ```bash
   apm install          # first install
   apm install --update # update to latest
   apm audit            # security scan
   ```

### What to commit

| Path                                                          | Action                              |
| :------------------------------------------------------------ | :---------------------------------- |
| `apm.yml`                                                     | ✅ Commit                            |
| `apm.lock.yaml`                                               | ✅ Commit                            |
| `.github/agents/`, `.github/instructions/`, `.github/skills/` | ✅ Commit (instant context on clone) |
| `apm_modules/`                                                | ❌ Add to `.gitignore`               |

### Using Templates Directly

1. Browse the [**Template List**](docs/template-list.md) to find what you need.
2. Copy the relevant `.md` files from `templates/` into your repository:
   - **[Instructions](templates/instructions/)** → `.github/instructions/`
   - **[Prompts](templates/prompts/)** → `.github/prompts/`
   - **[Agents](templates/agents/)** → `.github/agents/`

## 🛠️ Template Library

This repository contains a wide range of production-ready templates:

<!-- AUTO:start template-stats -->
| Category         | Count | Location                            | Purpose                                  |
| :--------------- | :---: | :---------------------------------- | :--------------------------------------- |
| **Agents**       |   0   | `templates/<domain>/agents/`        | Specialized expert roles (@-mentions)    |
| **Skills**       |   0   | `templates/<domain>/skills/<name>/` | Reusable task-specific workflows         |
| **Prompts**      |   0   | `templates/<domain>/prompts/`       | Task-specific workflows (slash commands) |
| **Instructions** |   0   | `templates/<domain>/instructions/`  | Persistent project rules and standards   |
<!-- AUTO:end template-stats -->

📄 **[Browse All Templates](docs/template-list.md)**

## 📦 APM Packages

apm-hub distributes domain packages via APM. Each package is installed with `apm install` and deployed to `.github/`, `.claude/`, `.cursor/`, `.opencode/`, and `.gemini/` automatically.

📄 **[Learn about Skills](docs/concepts/skills.md)** · 📄 **[Browse All Skills](docs/skill-list.md)**

<!-- AUTO:start plugin-table -->
| Plugin | Description |
| :----- | :---------- |
<!-- AUTO:end plugin-table -->

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a template or package.

---

> **Tip**: Add individual packages to your project's `apm.yml` and run `apm install` to get started.

