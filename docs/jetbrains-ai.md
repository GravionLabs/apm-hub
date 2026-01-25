# Usage by JetBrains AI (Junie)


This document describes how **JetBrains Junie** (the AI agent in JetBrains IDEs) uses and interprets the GitHub Copilot configuration files defined in this repository.

---

## Overview

Although the files under `templates/` are primarily optimized for **GitHub Copilot**, **Junie** can also use this information to ensure a consistent experience within the JetBrains development environment.

The main difference lies in the **method of application**: While Copilot loads many of these files automatically in the background, Junie uses them as explicit project context.

---

## 1. Usage of Instructions (`templates/instructions/`)

In GitHub Copilot, `copilot-instructions.md` and profile-specific instructions are automatically applied to every chat contribution.

**How Junie uses them:**
- **Project Context:** Junie analyzes these files when starting or indexing the repository. They serve as the "ground rules" for code style and security guidelines.
- **Explicit Reference:** When you ask Junie to write or review code, you can refer to these files (e.g., "Check the code according to our security instructions"). Junie then reads the specific rules (e.g., from `templates/instructions/security.instructions.md`).

---

## 2. Usage of Prompts (`templates/prompts/`)

Prompts are designed as slash commands (`/`).

**How Junie uses them:**
- **Template Knowledge:** Junie knows the structure of these prompts. Even if the IDE's automatic slash command integration is primarily geared towards Copilot, Junie can use the content of these Markdown files if you ask for a specific workflow (e.g., "Perform a code review as defined in `code-review.prompt.md`").
- **Input Placeholders:** Junie understands variables like `${input:file}` or `${selection}` and can resolve them within the conversation context.

---

## 3. Usage of Agents (`templates/agents/`)

Agents define roles and personas (`@`).

**How Junie uses them:**
- **Role Adoption:** Junie can adopt an agent's persona if you ask it to. Since agent files (`*.agent.md`) contain clearly defined behaviors and boundaries, Junie uses these as system instructions for the current session.
- **Example:** "Act as the `migration-agent.agent.md` from this repo and plan the upgrade to Java 21."

---

## Summary of Differences

| Feature | GitHub Copilot | JetBrains Junie |
| :--- | :--- | :--- |
| **Activation** | Automatic (Background) | Context-based (Explicit/Index) |
| **Validity** | Permanently active | Task-related |
| **Visibility** | Acts implicitly | Uses files as reference source |

### Best Practice for Junie Users
To get the most out of these templates with Junie, it is recommended to briefly set the context at the beginning of a complex task:
> *"Junie, please follow our global instructions for the following task and use the role of the security auditor from `templates/agents/security.agent.md`."*
