# How to Use Instructions

Instructions provide the background rules for Copilot. Unlike prompts, you don't "run" them manually—they are always active. This guide explains how to ensure they are applied correctly.

---

## 1. Automatic Application

Once instructions are placed in the correct location within your repository, Copilot will automatically include them in the context of your conversations.

-   **Repository-wide rules** are always considered for any chat in the repo.
-   **Scoped rules** are only considered when you are working on files that match the defined glob pattern.

---

## 2. Verifying Scoped Instructions

If you have scoped instructions (e.g., for `frontend` or `backend`), you can verify they are active by:

1.  Opening a file that falls within the scoped directory (e.g., `src/frontend/App.tsx`).
2.  Asking Copilot a question related to that file.
3.  The instructions defined for that scope (e.g., `templates/instructions/frontend.instructions.md`) will be used by Copilot to generate the response.

---

## 3. Best Practices for Usage

-   **Keep them updated:** As project standards evolve, make sure to update the instructions in `.github/copilot-instructions.md`.
-   **Check for conflicts:** If Copilot is giving inconsistent advice, check if repo-wide instructions conflict with scoped instructions.
-   **Don't over-rely:** Instructions are for general rules. For specific, complex tasks, a prompt is often more effective.

---

## 4. Where to Find Instructions

-   **Global:** `.github/copilot-instructions.md`
-   **Scoped:** `.github/instructions/`

---

## 5. Learning More

-   [What are Instructions?](../concepts/instructions.md)
-   [Writing Good Instructions](../best-practices/writing-good-instructions.md)
-   [Instruction Review Checklist](../checklists/instructions-review-checklist.md)
