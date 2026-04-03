# Subagents

This document explains what **Subagents** are in the context of **GitHub Copilot**, how they differ from custom agents, and when to use them.

---

## What Is a Subagent?

A **Subagent** is an isolated agent instance spawned by the main Copilot agent to handle a delegated task in its own context window. The subagent works independently without pausing for user feedback and returns its final result to the main session.

Subagents answer the question:

> **"Who handles this complex subtask without cluttering the main session?"**

> **Note:** Subagents are a **runtime concept** — they are not defined in files. There is no `.subagent.md` or similar configuration file.

---

## When to Use Subagents

Subagents are best suited when:

- You want to **delegate complex, multi-step tasks** (research, analysis) without interrupting your main session
- You need to process **large amounts of information** or multiple documents that would clutter your primary context window
- You want to **explore different approaches** or perspectives independently without mixing contexts

✅ **Good subagent use cases:**
- Codebase research and exploration
- Running and analyzing test suites
- Generating a PR description based on a prior code review
- Analyzing large log files or documentation

❌ **Not suited for subagents:**
- Short, simple tasks (use a direct prompt)
- Tasks that require continuous user interaction (use regular agent mode)
- Tasks that need to spawn further subagents (subagents **cannot** create their own subagents)

---

## Subagents vs. Custom Agents

| Aspect          | Subagent                            | Custom Agent (`.agent.md`)           |
| :-------------- | :---------------------------------- | :----------------------------------- |
| **Configuration** | None — runtime process            | `.github/agents/AGENT-NAME.md` file  |
| **Trigger**     | Automatic or explicit in prompt     | Manual via `@agent-name`             |
| **Context**     | Isolated context window             | Shares session context               |
| **Persistence** | Ends when task is done              | Active for the session duration      |
| **Nesting**     | Cannot create subagents             | Can instruct subagents               |
| **Model**       | Same as main session (default)      | Inherits session model               |

---

## How Subagents Are Triggered

### 1. Automatic Delegation
Copilot analyzes your prompt and available custom agents, then automatically delegates to the most fitting subagent:

```text
Suggest ways to refactor this legacy code.
```

If a `refactor-specialist` custom agent is configured, Copilot may automatically delegate this task to it as a subagent.

### 2. Direct Invocation
Reference a subagent explicitly in your prompt:

```text
Use the testing subagent to write unit tests for the authentication module.
```

### 3. Via the `#runSubagent` Tool
For precise control, reference the tool directly:

```text
Evaluate #file:databaseSchema using #runSubagent and generate an optimized data-migration plan.
```

---

## Using Subagents in Custom Agents and Prompt Files

To allow a custom agent or prompt file to spawn subagents, include `runSubagent` in the `tools` frontmatter:

```markdown
---
name: My Orchestrator Agent
description: Orchestrates code review and PR creation
tools:
  - runSubagent
  - file-search
---

Perform the following steps:

1. Use runSubagent to delegate a code review to the code-review agent.
2. Wait for the result.
3. Use runSubagent to create a PR based on the review findings.
```

---

## Subagents in Copilot CLI (Autopilot Mode)

In **Copilot CLI**, subagents are used automatically in autopilot and fleet modes to parallelize work across multiple isolated contexts. The `task` tool in CLI agents supports spawning subagents with a specific `model` override:

```text
Use the task tool with:
- agent_type: "code-review"
- model: "gpt-5.4"
- prompt: "Review all changed files in the current branch..."
```

See [Sub-Tasks with Custom Models](../../subtask-model-anweisungen.txt) for a detailed reference.

---

## IDE and Surface Support

| Surface          | Subagents Supported |
| :--------------- | :------------------ |
| VS Code          | ✓                   |
| JetBrains IDEs   | Preview             |
| Copilot CLI      | ✓                   |
| GitHub.com       | ✗                   |

---

## Related

- [Agents](agents.md) — custom agent personas (`.agent.md`)
- [Skills](skills.md) — specialized know-how loaded automatically
- [Hooks](hooks.md) — lifecycle events including `subagentStop`

---

## Further Reading

- [Using subagents in VS Code](https://docs.github.com/en/copilot/how-tos/chat-with-copilot/chat-in-ide#using-subagents) — GitHub Docs: enabling and invoking subagents
- [Copilot customization cheat sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet) — GitHub Docs: comparison of all customization options
