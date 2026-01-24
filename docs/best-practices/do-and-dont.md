# Do & Don't for GitHub Copilot

Follow these general guidelines to get the most out of GitHub Copilot while ensuring safety and code quality.

---

## ✅ Do

-   **Review every suggestion:** Treat Copilot as an assistant, not an oracle. Always verify the code for correctness, security, and performance.
-   **Provide context:** Use `@workspace`, open relevant files, and highlight specific code to give Copilot the information it needs.
-   **Be specific:** Use clear, actionable language in your prompts.
-   **Use the right tool for the job:**
    -   Use **Instructions** for global rules.
    -   Use **Agents** for specialized roles.
    -   Use **Prompts** for repeatable tasks.
-   **Report bad suggestions:** If Copilot consistently gives poor advice, refine your instructions or prompts to improve future interactions.

---

## ❌ Don't

-   **Blindly accept code:** Never merge Copilot-generated code without understanding what it does.
-   **Share secrets:** Do not paste API keys, passwords, or other sensitive information into the chat.
-   **Over-rely on AI:** AI is a tool to help you work faster, not a replacement for fundamental programming knowledge and critical thinking.
-   **Ignore security warnings:** If a custom agent or Copilot flags a security risk, take it seriously and investigate.
-   **Use the wrong abstraction:** Don't use a global instruction for a one-time task, and don't use a prompt for a rule that should always apply.
