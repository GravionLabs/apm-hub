
# Agents


This document explains what **Agents** are in the context of **GitHub Copilot**, how they differ from prompts and instructions, and how to design, store, and use them in this repository.

> **Mental model**
>
> - **Instructions** → define the **rules** (persistent guidance)
> - **Agent** → defines the **role** (persona + allowed tools)
> - **Prompt** → defines the **task** (what to do right now)

---

## 1) What is an Agent?

An **Agent** is a **specialized persona** that Copilot can adopt.  
It determines *who* Copilot is acting as and *which capabilities/tools* it may use.

Typical examples:
- **Security Reviewer** – reads diffs/files, flags risks, proposes safe fixes
- **Test Engineer** – proposes test plan then generates focused, maintainable tests
- **Documentation Writer** – produces concise docs with examples and API summaries
- **Migration Assistant** – plans safe, stepwise migrations with rollback strategy

Agents are **not** task scripts. They don’t encode a specific workflow (that’s for prompts).  
Instead, they set **stable behavior and boundaries** for a role, which you can then combine with different prompts.

---

## 2) Types of Agents

### 2.1 Built‑in/context agents (mentions)

These agents attach **specific context** to the conversation and are invoked with `@` in Copilot Chat (IDE‑dependent). Examples include:

- `@workspace` – grants knowledge of the repository’s codebase
- `@terminal` – includes terminal output/commands as context
- `@vscode` – uses editor diagnostics, active file, selections
- Other environment‑specific mentions (e.g., `@azure`, `@github`)

They **don’t change** Copilot’s persona; they **add context**.

### 2.2 Custom agents (user‑defined)

**Custom agents** are files in your repo that define:
- **Role/persona** (what the agent is)
- **Behavior** (how it should act)
- **Boundaries** (what it must *not* do)
- **Tools** (what it is allowed to use)

They can be selected in the chat UI and combined with prompts to perform a wide range of tasks within safe limits.

---

## 3) Where agents live

**Location in your repository:**

```text
.github/agents/*.agent.md
```

**Reusable templates in this repository:**

```text
templates/agents/*.agent.md
```

**Typical file name:**

```text
security-reviewer.agent.md
```

---

## 4) When Should You Use an Agent?

Use an agent when you want to define a **long-term role or persona** rather than a single task.

✅ **Good agent use cases:**
- **Security Auditor:** Always looking for vulnerabilities and enforcing secure coding patterns.
- **Architect:** Reviewing designs against architectural principles and patterns.
- **Test Lead:** Planning test strategies and ensuring comprehensive coverage.
- **Onboarding Buddy:** Helping new developers understand the codebase and conventions.

❌ **Bad agent use cases:**
- **Single tasks:** "Explain this function" (use a prompt).
- **Global rules:** "Always use tabs for indentation" (use instructions).
- **Temporary context:** Adding one specific file to the conversation (use `@workspace` or `#file`).

---

## 5) Agent vs. Prompt vs. Instructions

| Concept          | Purpose                     | Scope         | Trigger      | Persistence |
| :--------------- | :-------------------------- | :------------ | :----------- | :---------- |
| **Instructions** | Define global rules         | Repository    | Automatic    | High        |
| **Agents**       | Define roles & capabilities | Session-level | Manual (`@`) | Medium      |
| **Prompts**      | Define a task               | Single action | Manual (`/`) | Low         |

---

## 6) Anatomy of an Agent File (`*.agent.md`)

An agent file consists of:
1. **YAML front-matter**: Defines metadata, capabilities, and tools.
2. **Body**: Defines the persona, behavior, and boundaries.

### Example:

```markdown
---
name: Security Auditor
description: Expert in identifying security risks and proposing safe fixes
tools:
  - file-search
  - code-review
---

You are a Senior Security Auditor. Your goal is to ensure all code changes meet the highest security standards.

### Behavior
- Analyze code for common vulnerabilities (OWASP Top 10).
- Suggest secure alternatives for risky patterns.
- Prioritize security over performance or brevity.

### Boundaries
- Do not approve changes; only provide feedback.
- Do not ignore potential risks, even if they seem minor.
```

### Key YAML Fields:
- `name`: The display name of the agent.
- `description`: A short summary shown in the UI.
- `tools`: (Optional) Specific capabilities the agent can access.

---

## 7) Designing Good Agents

A high-quality agent should:
- **Have a clear persona:** Define who the agent is and what its expertise is.
- **Define boundaries:** Explicitly state what the agent should *not* do.
- **Specify behavior:** Provide clear guidelines on how the agent should approach tasks.
- **Be complementary:** Ensure it works well with existing instructions and prompts.

---

## 8) Agents in This Repository

This repository contains:
- **Production-ready agents** under `templates/agents/`
- **Examples and usage** under `examples/agents/`
- **Best practices** in [designing-agents](../best-practices/designing-agents.md)

All agents are designed to provide specialized expertise while adhering to the repository's core principles of safety and clarity.
