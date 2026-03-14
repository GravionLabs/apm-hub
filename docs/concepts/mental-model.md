---
description: 'Understanding how Instructions, Agents, and Prompts work together in GitHub Copilot'
---

## Shared Mental Model

To get the most out of GitHub Copilot, it helps to understand how the different configuration options work together.

We use a simple mental model to distinguish between **Instructions**, **Agents**, and **Prompts**:

---

## The Model

- **Instructions** → Define the **Rules** (Persistent)
- **Agent** → Defines the **Role** (Session-level)
- **Prompt** → Defines the **Task** (Single interaction)

---

### 1. Instructions: The Guardrails (The "How")
Instructions are the foundation. They define the "how" of your project—the standards, patterns, and rules that should *always* apply.

- **Analogy:** The company handbook or the project's style guide.
- **Example:** "Always use TypeScript," "Prefer async/await," "No semi-colons."
- **Persistence:** High. They are always active in the background.

### 2. Agents: The Experts (The "Who")
Agents set the persona and context for a conversation. They determine the expertise and the tools Copilot brings to the table.

- **Analogy:** Hiring a specialist (e.g., a Security Consultant or a DevOps Engineer).
- **Example:** `@workspace` (the expert on your code), `@security-auditor` (the expert on risks).
- **Persistence:** Medium. They stay active for the duration of a chat session.

### 3. Prompts: The Actions (The "What")
Prompts are specific, repeatable tasks. They are the immediate actions you want Copilot to perform right now.

- **Analogy:** A ticket in a sprint or a specific request to a colleague.
- **Example:** `/explain-code`, `/generate-tests`, `/review-changes`.
- **Persistence:** Low. They apply only to the current message.

---

## How They Work Together

When you interact with Copilot, all three layers can influence the result:

1. **Instructions** provide the global constraints.
2. **The Agent** provides the perspective and tools.
3. **The Prompt** provides the specific objective.

**Example Scenario:**
> You use the `/review` prompt while the `@security-auditor` agent is active.
>
> - **The Prompt (`/review`)** tells Copilot to look at your code and find issues.
> - **The Agent (`@security-auditor`)** ensures the review focuses on vulnerabilities and risks.
> - **The Instructions (`copilot-instructions.md`)** ensure that any suggested fixes follow your project's coding standards.

---

## Summary Table

| Layer            | Focus | Persistence   | Trigger      |
| :--------------- | :---- | :------------ | :----------- |
| **Instructions** | Rules | Persistent    | Automatic    |
| **Agents**       | Roles | Session       | Manual (`@`) |
| **Prompts**      | Tasks | Single Action | Manual (`/`) |
