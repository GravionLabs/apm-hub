# Designing Agents


Designing a good custom agent involves defining a clear role, setting appropriate boundaries, and providing the right tools.

---

## 1. Define a Clear Persona

Give your agent a specific identity. An agent that is a "generic helper" is less effective than one that is a "Senior DevOps Engineer" or a "Security Researcher".

-   **Expertise:** What does this agent know best?
-   **Tone:** How should it communicate? (e.g., professional, concise, encouraging).
-   **Perspective:** What are its priorities? (e.g., security, performance, maintainability).

---

## 2. Set Explicit Boundaries

Define what the agent is *not* allowed to do or what it should avoid. This prevents the agent from overreaching or giving dangerous advice.

-   "Do not suggest changes that involve sensitive credentials."
-   "Do not approve code; only provide feedback."
-   "Stay within the scope of the current technology stack."

---

## 3. Choose the Right Tools

If your agent needs specific capabilities, make sure to define them in the `tools` section of the YAML front-matter.

-   `file-search`: For finding files across the workspace.
-   `code-review`: For analyzing diffs and PRs.
-   `terminal`: For executing and reading terminal commands.

---

## 4. Behavior over Workflow

Agents should define **behavior and boundaries**, not specific task-oriented workflows. If you find yourself writing step-by-step instructions for a single task, that logic probably belongs in a **Prompt**.

---

## 5. Complementary Design

Ensure your agent respects the repository's global **Instructions**. Agents should add specialized expertise on top of the existing rules, not contradict them.

---

## Learning More

- [What are Agents?](../concepts/agents.md)
- [How to Use Agents](../usage/how-to-use-agents.md)
