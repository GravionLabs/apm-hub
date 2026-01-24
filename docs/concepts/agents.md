
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

## 3) Where agents live in this repository

For this repository, we store custom agents here:
