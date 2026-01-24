# Prompt Review Checklist

This checklist helps reviewers evaluate the **quality, safety, and usefulness** of GitHub Copilot prompt files (`*.prompt.md`) before they are merged.

Use this checklist during code review to ensure prompts are **clear, reusable, and aligned with best practices**.

---

## 1. Purpose & Scope ✅ (Must‑Have)

- [ ] The prompt has **one clear, well‑defined purpose**
- [ ] The task can be described in **one sentence**
- [ ] The prompt does **not combine unrelated tasks**
- [ ] The prompt is useful for **more than a single project or person**

✅ A reviewer should be able to answer:  
**“When should I use this prompt?”**

---

## 2. File Metadata & Structure ✅ (Must‑Have)

- [ ] File name follows `kebab-case` and describes the task clearly  
       _(e.g. `explain-code.prompt.md`, not `helper.prompt.md`)_
- [ ] File extension is `.prompt.md`
- [ ] YAML frontmatter is present
- [ ] `description` accurately reflects the prompt’s behavior
- [ ] `agent` selection is appropriate for the task

✅ The file should be self‑explaining without opening the content.

---

## 3. Task Definition & Instructions ✅ (Must‑Have)

- [ ] The task is **explicitly stated** at the beginning
- [ ] Expected output is clearly described
- [ ] There is no ambiguity about what Copilot should do
- [ ] The prompt avoids vague language (e.g. “help”, “improve”, “make better”)

✅ Copilot should not need to “guess” the user’s intent.

---

## 4. Inputs & Placeholders ✅ (Must‑Have)

- [ ] All required inputs use `${input:...}` placeholders
- [ ] Input names are meaningful and self‑describing
- [ ] Inputs are limited to what is strictly necessary
- [ ] Optional inputs are clearly labeled or implied

✅ A user should immediately know **what to paste where**.

---

## 5. Output Quality & Guidance ✅ (Must‑Have)

- [ ] Output structure is specified (lists, steps, sections, etc.)
- [ ] The prompt encourages **actionable results**
- [ ] The prompt defines what _not_ to do where relevant
- [ ] Overly verbose or overly short outputs are avoided

✅ The prompt should produce **consistent, predictable results**.

---

## 6. Reusability & Maintainability ⭐ (Should‑Have)

- [ ] The prompt is **generic enough** to be reused across projects
- [ ] It does not assume a specific framework unless intentional
- [ ] It avoids hard‑coded file names or paths
- [ ] The wording is easy to adjust or extend later

✅ A good prompt should age well over time.

---

## 7. Safety & Responsibility ⭐ (Should‑Have)

- [ ] The prompt does not encourage insecure practices
- [ ] No instructions to expose secrets or credentials
- [ ] No guidance that bypasses security, reviews, or policies
- [ ] Sensitive domains (security, data, auth) include explicit care

✅ Prompts should reflect **responsible AI usage**.

---

## 8. Agent Compatibility ⭐ (Should‑Have)

- [ ] The prompt works correctly with the selected agent
- [ ] It does not rely on tools the agent cannot access
- [ ] It does not conflict with repository‑wide instructions
- [ ] Agent behavior and prompt intent are aligned

✅ Prompt and agent should **complement**, not fight each other.

---

## 9. Language & Style ✨ (Nice‑to‑Have)

- [ ] Language is clear, neutral, and professional
- [ ] Instructions use short, direct sentences
- [ ] Bullets are preferred over long paragraphs
- [ ] Markdown formatting improves readability

✅ Good formatting improves adoption and longevity.

---

## 10. Reviewer Final Questions ✅

Before approving, ask yourself:

- [ ] Would I actually use this prompt?
- [ ] Would a new team member understand it?
- [ ] Does this reduce repetitive work?
- [ ] Does it fit the mission of this repository?

✅ If all answers are “yes”, the prompt is likely ready to merge.

---

## Approval Guideline

A prompt should:

- ✅ Pass **all Must‑Have checks**
- ✅ Fail **no safety checks**
- ⭐ Pass most Should‑Have checks

Nice‑to‑Have items are optional and should not block approval.

---

## Suggested Review Comment (Example)

> ✅ Prompt purpose is clear and well‑scoped.  
> ✅ Input placeholders are well defined.  
> 🔧 Consider tightening the output structure to improve consistency.
