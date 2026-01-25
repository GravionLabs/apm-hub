# Prompts (Prompt Files)


This document explains what **Prompts** are in the context of **GitHub Copilot**, how they differ from instructions and agents, and how they should be designed and used in this repository.

---

## What Is a Prompt?

In GitHub Copilot, a **prompt** is a **task‑specific instruction** that tells Copilot exactly what to do for a single interaction.

Prompts answer the question:

> **“What do I want Copilot to do right now?”**

Examples:

- Explain a piece of code
- Generate unit tests
- Review a change
- Suggest refactorings
- Write documentation

Prompts are **explicitly invoked** by the user and are **not persistent**.

---

## Prompt Files (`*.prompt.md`)

GitHub Copilot supports **reusable prompt files** stored in a repository.

**Key characteristics**

- Stored as Markdown files
- Version‑controlled
- Shared across a team
- Exposed as **slash commands** in supported IDEs

**Location in your repository:**

```text
.github/prompts/*.prompt.md
```

**Reusable templates in this repository:**

```text
templates/prompts/*.prompt.md
```

**Typical file name**

```text
explain-code.prompt.md
```

When a prompt file is available, it can be invoked like this in Copilot Chat:

```text
/explain-code
```

## When Should You Use a Prompt?

Use a prompt when:

- The task is repeatable
- You find yourself copying the same instructions repeatedly
- The task is procedural or outcome‑oriented
- The behavior should not apply globally

✅ Good prompt use cases:

- Code explanation
- Code review
- Test generation
- Refactoring suggestions
- Writing release notes or documentation

❌ Bad prompt use cases:

- Enforcing coding standards (use instructions)
- Defining long‑term project rules
- Describing agent personas (use agents)

## Prompt vs. Instructions vs. Agents

| Concept      | Purpose                     | Scope         | Trigger    | Persistence |
| ------------ | --------------------------- | ------------- | ---------- | ----------- |
| **Instructions** | Define global rules         | Persistent    | Automatic  | High        |
| **Agents**       | Define roles & capabilities | Session-level | Manual (`@`) | Medium      |
| **Prompts**      | Define a task               | Single action | Manual (`/`) | Low         |

## Anatomy of a Prompt File

A prompt file consists of:

1. YAML front-matter
2. Prompt body (task instructions)

Example:

```Markdown

---
agent: agent
description: Explain code in a clear and structured way
---
Explain the following code in plain, beginner‑friendly language.

Code:
${input:code:Paste code here}

Target audience:
${input:audience:Who is this explanation for?}

Include:
- High‑level overview
- Step‑by‑step explanation
- Key concepts
- Simple example

```

## YAML front-matter

The front-matter defines how Copilot should run the prompt.
Common fields:

- agent

  Determines which Copilot mode or agent is used (e.g. agent mode).

- description

  Shown in IDEs to explain what the prompt does.

✅ Front-matter should be accurate, minimal, and descriptive.

## Input Placeholders

Prompts can define structured inputs using placeholders:

```text
${input:<name>:<description>}
```

## Guidelines

- Use meaningful names (e.g. code, language, framework)
- Keep inputs minimal
- Describe clearly what the user should provide
- Avoid optional inputs unless necessary

✅ Good:

```text
${input:code:Paste the code to review}
```

❌ Bad:

```text
${input:data}
```

## Designing Good Prompts

A high‑quality prompt should:

- Focus on one task
- Clearly define expected output
- Prefer structure over prose
- Avoid assumptions about the codebase
- Produce predictable results

Recommended Prompt Structure

- Task statement
- Required inputs
- Output expectations
- Constraints or exclusions

## What Prompts Should NOT Do

Prompts should not:

- Encode long‑term project rules
- Replace documentation or policies
- Override security practices
- Act as a “generic helper”
- Depend on specific repositories unless explicitly stated

If a rule should always apply, it belongs in instructions, not in a prompt.

## Prompts in This Repository

This repository contains:

- Production‑ready prompts under `templates/prompts/`
- Examples and usage explanations under examples/prompts/
- Review guidelines in [prompt-review-checklist](../checklists/prompt-review-checklist.md)

All prompts are intended to be:

- Reusable
- Safe by default
- Independent of specific projects
