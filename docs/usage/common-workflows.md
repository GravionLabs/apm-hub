# Common Copilot Workflows


This guide describes how to combine instructions, agents, and prompts to solve common development tasks effectively.

---

## 1. Code Review

**Goal:** Get a comprehensive review of your changes before opening a PR.

1.  **Agent:** Switch to `@workspace` or a custom `@security-auditor`.
2.  **Prompt:** Use `/review` or `/code-review`.
3.  **Context:** The agent looks at your staged changes or the active file, while **Instructions** ensure the review follows project-specific naming conventions and standards.

---

## 2. Test-Driven Development (TDD)

**Goal:** Generate tests for new functionality or improve coverage.

1.  **Agent:** Use `@workspace` to understand existing test patterns.
2.  **Prompt:** Use `/tests` or a custom prompt that generates unit tests.
3.  **Interaction:** Provide the target file as input. **Instructions** ensure the tests use the preferred testing library (e.g., Jest, Pytest).

---

## 3. Refactoring Legacy Code

**Goal:** Clean up old code while maintaining behavior.

1.  **Agent:** Use `@workspace` to find usages and dependencies.
2.  **Prompt:** Use `/refactor` with specific goals (e.g., "extract method", "simplify logic").
3.  **Constraints:** **Instructions** prevent the use of deprecated APIs during the refactoring process.

---

## 4. Onboarding & Exploration

**Goal:** Quickly understand an unfamiliar part of the codebase.

1.  **Agent:** Always use `@workspace`.
2.  **Query:** "Explain how the authentication flow works" or "Where is the main entry point for the API?".
3.  **Outcome:** Copilot provides a high-level overview based on the repository structure.

---

## 5. Documentation Generation

**Goal:** Create or update READMEs, KDocs, or API documentation.

1.  **Prompt:** Use `/doc` or `/explain-code`.
2.  **Input:** Select the class or function that needs documentation.
3.  **Style:** **Instructions** define the preferred documentation format (e.g., Javadoc style, Markdown).
