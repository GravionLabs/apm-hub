# Instructions (Custom Instructions)

This document explains what **Instructions** are in the context of **GitHub Copilot**, how they differ from prompts and agents, and how to define and use them in this repository.

---

## What are Instructions?

**Instructions** (also known as Custom Instructions) are **persistent rules and guidance** that influence Copilot's behavior across a repository or a specific part of it.

Instructions answer the question:

> **"What global rules should Copilot always follow in this project?"**

Examples:
- "Always use TypeScript for new files."
- "Prefer functional components over class components."
- "Follow the project's naming conventions for tests."
- "Include error handling in every public method."

Unlike prompts, instructions are **automatically applied** and do not need to be manually triggered by the user for every interaction.

---

## Types of Instructions

### 1. Repository-wide Instructions
These apply to the entire repository. They are typically used for general coding standards, project context, and high-level rules.

**Location:**
```text
.github/copilot-instructions.md
```

### 2. Scoped Instructions
These apply only to specific files or directories, defined by glob patterns. They are useful for technology-specific rules (e.g., frontend vs. backend).

**Location in your repository:**
```text
.github/instructions/*.instructions.md
```

**Reusable templates in this repository:**
```text
templates/instructions/*.instructions.md
```

---

## When Should You Use Instructions?

Use instructions when:
- A rule should be **consistently applied** throughout the project.
- You want to enforce **coding standards or architectural patterns**.
- You want to provide **permanent context** about the tech stack or libraries.

✅ **Good instruction use cases:**
- Enforcing linting rules.
- Defining library preferences (e.g., "Use Tailwind CSS").
- Specifying documentation requirements.

❌ **Bad instruction use cases:**
- **Single tasks:** "Refactor this code" (use a prompt).
- **Temporary roles:** "Act as a security expert" (use an agent).

---

## Instructions vs. Prompts vs. Agents

| Concept      | Purpose                     | Scope         | Trigger    |
| ------------ | --------------------------- | ------------- | ---------- |
| **Instructions** | Define global rules         | Persistent    | Automatic  |
| **Agents**       | Define roles & capabilities | Session-level | Manual (`@`) |
| **Prompts**      | Define a task               | Single action | Manual (`/`) |

---

## Anatomy of a Scoped Instruction File

Scoped instruction files can include YAML front-matter to define which files they apply to.

```markdown
---
applyTo: "src/components/**/*.tsx"
---
Always use functional components and hooks.
Follow the atomic design pattern for component structure.
```

---

## Guidelines for Writing Good Instructions

- **Be concise:** Only include rules that are truly important.
- **Be specific:** Avoid vague guidance like "write good code".
- **Focus on stability:** Instructions should define long-term patterns, not temporary fixes.
- **Avoid conflicts:** Ensure repo-wide and scoped instructions don't contradict each other.

---

## Instructions in This Repository

This repository contains:
- **Global instructions** in `templates/copilot-instructions.md`
- **Scoped instruction templates** under `templates/instructions/`
- **Review guidelines** in [instruction-review-checklist](../checklists/instructions-review-checklist.md)
