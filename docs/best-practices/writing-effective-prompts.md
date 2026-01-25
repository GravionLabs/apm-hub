# Writing Effective Prompts


A well-written prompt leads to better, more predictable results from GitHub Copilot. Follow these best practices when creating custom `.prompt.md` files.

---

## 1. One Task, One Prompt

Keep prompts focused. A prompt that tries to explain, refactor, and test code at the same time will likely produce mediocre results for all three.

-   ✅ **Good:** `explain-logic.prompt.md`
-   ❌ **Bad:** `do-everything.prompt.md`

---

## 2. Use Structured Inputs

Use `${input:name:description}` to make your prompts interactive and reusable. This ensures the user provides exactly what the prompt needs.

```markdown
Review this code for performance issues:
${input:code:Paste the code here}
Focus on: ${input:focus:e.g., memory, latency, or CPU}
```

---

## 3. Define the Output Format

Be explicit about how you want the response to look. Use Markdown, lists, or specific sections to guide Copilot.

-   "Provide the answer as a bulleted list."
-   "Wrap the code in a triple-backtick block."
-   "Start with a high-level summary, followed by a detailed analysis."

---

## 4. Provide Context, but Keep it Relevant

While context is good, too much irrelevant information can confuse the model. Focus on the inputs that are strictly necessary for the task.

---

## 5. Use Clear, Actionable Language

Avoid vague verbs like "improve" or "fix". Use specific commands:
-   "Refactor this into a functional component."
-   "Identify potential null pointer exceptions."
-   "Convert this loop into a stream operation."

---

## 6. Iterative Refinement

If a prompt doesn't give you what you want, don't give up. Adjust the wording, add constraints, or change the output format until it produces consistent, high-quality results.

---

## Learning More

- [What are Prompts?](../concepts/prompts.md)
- [How to Use Prompts](../usage/how-to-use-prompts.md)
- [Prompt Review Checklist](../checklists/prompt-review-checklist.md)
