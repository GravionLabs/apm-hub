# apm-hub

A curated hub for sharing GitHub Copilot instructions, agents, prompts, and APM packages — your team's Copilot marketplace.

---

## What is apm-hub?

**apm-hub** is a shared library of reusable GitHub Copilot templates — instructions, agents, and prompts — distributed as **APM packages** via [Agent Package Manager](https://microsoft.github.io/apm/). Each package is a curated, domain-specific bundle of agents, skills, and instructions you can install into any repository with a single command.

---

## 📖 Documentation

- **[Overview](docs/overview.md)**: Introduction, core concepts, and guiding principles.
- **[Prerequisites](docs/prerequisites.md)**: System requirements and setup guide for apm-hub skills.
- **[LSP Configuration](docs/lsp-configuration.md)**: Enable precise code intelligence with Language Server Protocol.
- **[Chronicle Optimization](docs/chronicle-optimization.md)**: Design skills for better session tracking and summarization.
- **[Context Management](docs/context-management.md)**: Optimize skills for long sessions and token efficiency.
- **[Context Audit Template](docs/context-audit-template.md)**: Audit and optimize existing large skills.
- **[JetBrains AI Support](docs/jetbrains-ai.md)**: How to use these templates with JetBrains Junie.
- **[Skills](docs/concepts/skills.md)**: What skills are and how they are generated from prompt templates.

## 🚀 Quick Start

### Prerequisites

Before using apm-hub skills, verify that your system has all required prerequisites:

```powershell
pwsh .github/skills/check-prerequisites/scripts/Check-Prerequisites.ps1
```

See **[Prerequisites Documentation](docs/prerequisites.md)** for detailed setup instructions for your platform.

### Installing packages with APM

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
   apm install angular@apm-hub
   apm install typescript@apm-hub
   apm install csharp@apm-hub
   ```

   Or install **all packages** at once:
   ```bash
   apm install all@apm-hub
   ```

4. Or add packages directly to your project's `apm.yml`:
   ```yaml
   name: my-project
   version: 1.0.0
   dependencies:
     apm:
       - GravionLabs/apm-hub/packages/angular
       - GravionLabs/apm-hub/packages/common
   ```
   Then run `apm install` to deploy to `.github/`, `.claude/`, `.cursor/` etc.

### What to commit in your project

| Path                                                          | Action                              |
| :------------------------------------------------------------ | :---------------------------------- |
| `apm.yml`                                                     | ✅ Commit                            |
| `apm.lock.yaml`                                               | ✅ Commit                            |
| `.github/agents/`, `.github/instructions/`, `.github/skills/` | ✅ Commit (instant context on clone) |
| `apm_modules/`                                                | ❌ Add to `.gitignore`               |

## 📦 APM Packages

apm-hub distributes domain packages via APM. Each package is installed with `apm install` and deployed to `.github/`, `.claude/`, `.cursor/`, `.opencode/`, and `.gemini/` automatically.

📄 **[Learn about Skills](docs/concepts/skills.md)** · 📄 **[Browse All Skills](docs/skill-list.md)**

<!-- AUTO:start template-stats -->
| Category         | Count | Location                            | Purpose                                  |
| :--------------- | :---: | :---------------------------------- | :--------------------------------------- |
| **Agents**       |   0   | `templates/<domain>/agents/`        | Specialized expert roles (@-mentions)    |
| **Skills**       |   0   | `templates/<domain>/skills/<name>/` | Reusable task-specific workflows         |
| **Prompts**      |   0   | `templates/<domain>/prompts/`       | Task-specific workflows (slash commands) |
| **Instructions** |   0   | `templates/<domain>/instructions/`  | Persistent project rules and standards   |
<!-- AUTO:end template-stats -->

<!-- AUTO:start plugin-table -->
| Plugin | Description |
| :----- | :---------- |
<!-- AUTO:end plugin-table -->

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a template or package.

### Contributor setup

After cloning, install Node.js dependencies:

```bash
npm install
```

The `.github/skills/`, `.github/instructions/` and `.github/agents/` directories are committed directly to this repo. When the `copilot-workspace` or `shared` packages are updated, run:

```bash
apm install ./packages/copilot-workspace ./packages/shared --force
```

Then commit the updated `.github/` files.

---

> **Tip**: Add individual packages to your project's `apm.yml` and run `apm install` to get started.
