# How to Use Agents

Agents in GitHub Copilot allow you to switch between different expert personas and sets of capabilities. This guide explains how to invoke and interact with them.

---

## 1. Invoking Agents (Mentions)

In the Copilot Chat window, you can invoke an agent by using the `@` symbol followed by the agent's name.

-   **Built-in Agents:** `@workspace`, `@terminal`, `@github`.
-   **Custom Agents:** Any custom agent defined in the `.github/agents/` directory (e.g., `@security-auditor`).

**Example:**
Type `@workspace how do I initialize the database?` to ask a question with full repository context.

---

## 2. Selecting Agents via UI

Most IDEs also provide a dropdown or selection menu within the Chat interface to choose an active agent without typing `@`.

1.  Look for the agent icon or name at the top of the Chat window.
2.  Click it to see a list of available agents.
3.  Select the one you want to use for the current session.

---

## 3. Combining Agents with Prompts

One of the most powerful ways to use agents is in combination with slash command prompts.

**Format:**
`@<agent> /<prompt>`

**Example:**
`@workspace /explain` – Uses the workspace agent's knowledge to explain the selected code.
`@security-auditor /review` – Performs a security-focused review of your changes.

---

## 4. Best Practices for Usage

-   **Use `@workspace` for broad questions:** If your question requires knowledge of multiple files or project structure, always start with `@workspace`.
-   **Switch agents for specific roles:** Switch to a specialized agent (like a migration assistant) when performing focused tasks to get more relevant expertise.
-   **Clear context if needed:** If you switch topics significantly, you may want to start a new chat session to clear the agent's recent conversation history.

---

## 5. Discovering Agents in This Repo

Custom agents are defined under:

```text
.github/agents/
```

---

## 6. Learning More

-   [What are Agents?](../concepts/agents.md)
-   [Designing Good Agents](../best-practices/designing-agents.md)
