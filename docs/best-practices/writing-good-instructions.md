# Writing Good Instructions

Instructions are the foundation of Copilot's behavior in your repository. Since they are always active, they must be clear, concise, and stable.

---

## 1. Keep it Concise

Every line in your instructions is added to the context of *every* interaction. Avoid long-winded explanations. Use short, direct rules.

-   ✅ **Good:** "Use async/await for all asynchronous operations."
-   ❌ **Bad:** "In this project, we have decided that it is generally better to use the async and await keywords whenever you are dealing with promises or other things that take time to complete, as it makes the code more readable and easier to maintain."

---

## 2. Focus on "What" and "How", not "Why"

The model needs to know the rules, not the history of why they exist. Focus on the actionable constraints.

---

## 3. Use Positive and Negative Constraints

Be clear about what to do and what to avoid.

-   **Positive:** "Prefer functional programming patterns."
-   **Negative:** "Do not use `var`; always use `const` or `let`."

---

## 4. Leverage Scoping

Don't put everything in the global `.github/copilot-instructions.md`. Use scoped instructions (`.github/instructions/*.instructions.md`) for technology-specific rules.

-   **Global:** General project standards, security policies.
-   **Scoped:** React-specific rules, backend API conventions, SQL style guides.

---

## 5. Avoid Over-Specifying

Don't try to document every single detail of your project. Focus on the rules that are most likely to be violated or where consistency is critical.

---

## 6. Test with Real Queries

After adding or updating instructions, ask Copilot a few questions to see if it follows the new rules without becoming overly restrictive or confused.
