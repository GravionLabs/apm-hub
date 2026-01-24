# How to Use Prompts

Prompts in GitHub Copilot are designed to be explicitly invoked by the user for specific tasks. This guide explains how to find, trigger, and interact with prompts.

---

## 1. Triggering Prompts (Slash Commands)

In supported IDEs (like VS Code or JetBrains), you can trigger reusable prompts using **slash commands** in the Copilot Chat window.

1.  Open **Copilot Chat**.
2.  Type `/` to see a list of available prompts.
3.  Select the desired prompt (e.g., `/explain`, `/tests`, or a custom one like `/code-review`).
4.  Press **Enter**.

---

## 2. Providing Input to Prompts

Many prompts require additional information to work effectively. They use placeholders that you need to fill.

### Manual Input
When you trigger a prompt with an `${input:...}` placeholder, the IDE will often prompt you to provide that information.

### Automatic Context
Some prompts automatically use the **active file** or **current selection** as context. Make sure you have the relevant code selected or the correct file open before running the prompt.

---

## 3. Best Practices for Usage

-   **Select code first:** If you want a prompt to act on a specific block of code, highlight it in the editor before invoking the slash command.
-   **Combine with Agents:** You can run a prompt while a specific agent is active (e.g., `@workspace /explain`) to give the prompt more context.
-   **Review the output:** Always treat the prompt output as a suggestion. Review, test, and refine the generated code or text.

---

## 4. Discovering Prompts in This Repo

You can find the source of all available prompts in this repository under:

```text
.github/prompts/
```

Each file (e.g., `refactor.prompt.md`) corresponds to a slash command (e.g., `/refactor`).

---

## 5. Learning More

-   [What are Prompts?](../concepts/prompts.md)
-   [Writing Effective Prompts](../best-practices/writing-effective-prompts.md)
-   [Prompt Review Checklist](../checklists/prompt-review-checklist.md)
